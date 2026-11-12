import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { KeptPhone, KeptPhoneFile } from '../../src/phone/keptPhone';
import { freshApp, reopenApp } from '../../src/phone/phoneReset';
import { afterBlock, BlockPhoneDeps, endKeptPhone, phoneForBlock } from '../../src/phone/phoneForBlock';
import { Phone } from '../../src/phone/phoneSession';

const APP = 'app.t2.test.availo';

function folder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kept-phone-'));
}

const KEPT: KeptPhone = { runId: '9001', sessionId: 's-1', filmPort: 5100, capabilities: { platformName: 'Android' } };

test('the kept phone session of a run is saved and read back', () => {
  const f = new KeptPhoneFile(folder());
  f.save(KEPT);
  expect(f.load('9001')).toEqual(KEPT);
});

test('another run never gets this run\'s kept session', () => {
  const f = new KeptPhoneFile(folder());
  f.save(KEPT);
  expect(f.load('9002')).toBeUndefined();
});

test('a forgotten session is gone; forgetting nothing does not fail', () => {
  const f = new KeptPhoneFile(folder());
  f.save(KEPT);
  f.forget('9001');
  expect(f.load('9001')).toBeUndefined();
  expect(() => f.forget('9001')).not.toThrow();
});

test('trap: a broken file is no kept session', () => {
  const dir = folder();
  const f = new KeptPhoneFile(dir);
  f.save(KEPT);
  fs.writeFileSync(f.file('9001'), '{not json');
  expect(f.load('9001')).toBeUndefined();
});

/** the commands a block start sends to the kept session */
function recorder(): { calls: string[]; call: (c: string, a: Record<string, unknown>) => Promise<unknown> } {
  const calls: string[] = [];
  return { calls, call: async (c, a) => { calls.push(`${c} ${JSON.stringify(a)}`); return null; } };
}

/** Java BaseTests: a block starts with the app's data cleared and its permissions granted (base.PhoneOptions) */
test('a fresh app: closed, its data cleared, every permission granted, opened', async () => {
  const r = recorder();
  await freshApp(r.call, APP);
  expect(r.calls).toEqual([
    `mobile: terminateApp {"appId":"${APP}"}`,
    `mobile: clearApp {"appId":"${APP}"}`,
    `mobile: changePermissions {"permissions":"all","appPackage":"${APP}","action":"grant"}`,
    `mobile: activateApp {"appId":"${APP}"}`,
  ]);
});

test('a kept-data block: the app is closed and opened again, its data kept', async () => {
  const r = recorder();
  await reopenApp(r.call, APP);
  expect(r.calls).toEqual([`mobile: terminateApp {"appId":"${APP}"}`, `mobile: activateApp {"appId":"${APP}"}`]);
});

/** fake phone sessions and what was done with them */
function deps(kept: KeptPhone | undefined, opts: { resetFails?: boolean } = {}): { d: BlockPhoneDeps; log: string[] } {
  const log: string[] = [];
  const phone = (name: string): Phone => ({ sessionId: name }) as unknown as Phone;
  const d: BlockPhoneDeps = {
    kept: () => kept,
    attach: async (k) => { log.push(`attach ${k.sessionId}`); return phone(k.sessionId); },
    open: async (port, keep) => { log.push(`open ${port} keep=${keep}`); return phone('s-new'); },
    freePort: async () => 5200,
    save: (p, port) => log.push(`save ${p.sessionId} ${port}`),
    forget: () => log.push('forget'),
    reset: async (p, keep) => {
      log.push(`reset ${p.sessionId} keep=${keep}`);
      if (opts.resetFails) throw new Error('invalid session id');
    },
    end: async (p) => { log.push(`end ${p.sessionId}`); },
  };
  return { d, log };
}

test('the first phone block opens a session and keeps it for the next blocks', async () => {
  const { d, log } = deps(undefined);
  const b = await phoneForBlock(false, d);
  expect(log).toEqual(['open 5200 keep=false', 'save s-new 5200']);
  expect(b.filmPort).toBe(5200);
});

test('a later block uses the kept session: no new session, the app made fresh', async () => {
  const { d, log } = deps(KEPT);
  const b = await phoneForBlock(false, d);
  expect(log).toEqual(['attach s-1', 'reset s-1 keep=false']);
  expect(b.phone.sessionId).toBe('s-1');
  expect(b.filmPort).toBe(5100);
});

test('Round 2: a session the run opened early (the app just started, as a new session starts it) is joined with no second reset - once', async () => {
  const { d, log } = deps({ ...KEPT, fresh: true });
  const b = await phoneForBlock(false, d);
  expect(log).toEqual(['attach s-1', 'save s-1 5100']); // saved again without the fresh mark: the next block resets
  expect(b.filmPort).toBe(5100);
});

test('a kept-data block on the kept session keeps the app\'s data', async () => {
  const { d, log } = deps(KEPT);
  await phoneForBlock(true, d);
  expect(log).toEqual(['attach s-1', 'reset s-1 keep=true']);
});

test('trap: a kept session that is gone is ended, forgotten and a new one opened', async () => {
  const { d, log } = deps(KEPT, { resetFails: true });
  const b = await phoneForBlock(false, d);
  expect(log).toEqual(['attach s-1', 'reset s-1 keep=false', 'end s-1', 'forget', 'open 5200 keep=false', 'save s-new 5200']);
  expect(b.phone.sessionId).toBe('s-new');
});

test('a passed block leaves its session for the next block', async () => {
  const { d, log } = deps(KEPT);
  await afterBlock({ sessionId: 's-1' } as unknown as Phone, true, d);
  expect(log).toEqual([]);
});

test('a failed block ends its session: the next block starts clean', async () => {
  const { d, log } = deps(KEPT);
  await afterBlock({ sessionId: 's-1' } as unknown as Phone, false, d);
  expect(log).toEqual(['end s-1', 'forget']);
});

test('the run\'s end closes the kept session so the phone is free for the next user', async () => {
  const ended: string[] = [];
  let forgotten = 0;
  await endKeptPhone({ kept: () => KEPT, endKept: async (k) => { ended.push(k.sessionId); }, forget: () => { forgotten++; } });
  expect(ended).toEqual(['s-1']);
  expect(forgotten).toBe(1);
});

test('the run\'s end with no kept session does nothing; a failed close still forgets it', async () => {
  let forgotten = 0;
  await endKeptPhone({ kept: () => undefined, endKept: async () => { throw new Error('x'); }, forget: () => { forgotten++; } });
  expect(forgotten).toBe(0);
  await endKeptPhone({ kept: () => KEPT, endKept: async () => { throw new Error('gone'); }, forget: () => { forgotten++; } });
  expect(forgotten).toBe(1);
});
