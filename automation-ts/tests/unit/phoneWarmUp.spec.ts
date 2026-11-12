import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { KeptPhoneFile } from '../../src/phone/keptPhone';
import { warmUpPlan, warmPhone, WarmDeps } from '../../src/phone/phoneWarmUp';
import { parseSuite } from '../../src/run/suitePlan';

/**
 * Round 2 speed (hybrid 64 run 655: the first phone block spent ~8 s opening its phone session after the web sign-in
 * block): the run's phone session opens WHILE the earlier blocks run; the first phone block joins it.
 */

const block = (name: string, groups: string, params = '') =>
  `<test name="${name}">${params}<groups><run>${groups}</run></groups><classes><class name="ts:tests/x.spec.ts"><methods><include name="m"/></methods></class></classes></test>`;

test('warm the phone only when an earlier block runs first, with the first phone block\'s own data choice', () => {
  const hybrid = parseSuite(`<suite name="s">${block('Log in', '<include name="Web"/>')}${block('Case - register', '<include name="Mob"/>')}</suite>`);
  expect(warmUpPlan(hybrid)).toEqual({ keepAppData: false });
  const leave = parseSuite(`<suite name="s">${block('Log in', '')}${block('Case 462', '<include name="Mob"/>', '<parameter name="keepAppData" value="true"/>')}</suite>`);
  expect(warmUpPlan(leave)).toEqual({ keepAppData: true });
  const phoneFirst = parseSuite(`<suite name="s">${block('Case - register', '<include name="Mob"/>')}</suite>`);
  expect(warmUpPlan(phoneFirst)).toBeUndefined(); // the block opens it itself - no extra reset
  const off = parseSuite(`<suite name="s"><parameter name="openPhoneEarly" value="off"/>${block('Log in', '')}${block('Case', '<include name="Mob"/>')}</suite>`);
  expect(warmUpPlan(off)).toBeUndefined(); // the setting turns it off
  const noPhone = parseSuite(`<suite name="s">${block('Log in', '<include name="Web"/>')}</suite>`);
  expect(warmUpPlan(noPhone)).toBeUndefined();
});

function deps(over: Partial<WarmDeps> = {}) {
  const seen: string[] = [];
  const d: WarmDeps = {
    held: async () => null, freePort: async () => 5100,
    open: async () => ({ sessionId: 's-9', capabilities: { platformName: 'Android' } }),
    save: (k) => seen.push(`save ${k.sessionId} ${k.filmPort} fresh=${k.fresh}`), pending: (on) => seen.push(`pending ${on}`), say: (l) => seen.push(l),
    ...over,
  };
  return { d, seen };
}

test('the session is opened and kept for the run; the pending mark is there only while it opens', async () => {
  const { d, seen } = deps();
  await warmPhone(d, false);
  expect(seen.filter((s) => !s.startsWith('Opened'))).toEqual(['pending true', 'save s-9 5100 fresh=true', 'pending false']);
});

test('a phone held by something else is never taken early; a session that does not open leaves the block to open its own', async () => {
  const held = deps({ held: async () => 'another test session drives it' });
  await warmPhone(held.d, false);
  expect(held.seen).toEqual(['pending true', 'pending false']); // marked at once, never opened
  const broken = deps({ open: async () => { throw new Error('no phone'); } });
  await expect(warmPhone(broken.d, false)).resolves.toBeUndefined();
  expect(broken.seen).toContain('pending false');
  expect(broken.seen.some((s) => s.startsWith('save'))).toBe(false);
});

test('a block waits for the session being opened, then joins it; a mark left behind is waited for at most the limit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'warm-'));
  const f = new KeptPhoneFile(dir);
  f.markPending('7', true);
  setTimeout(() => { f.save({ runId: '7', sessionId: 's-1', filmPort: 1, capabilities: {} }); f.markPending('7', false); }, 150);
  expect((await f.loadWhenReady('7', 3000, 20))?.sessionId).toBe('s-1');
  f.forget('7');
  f.markPending('7', true);
  const started = Date.now();
  expect(await f.loadWhenReady('7', 200, 20)).toBeUndefined();
  expect(Date.now() - started).toBeLessThan(1500);
});
