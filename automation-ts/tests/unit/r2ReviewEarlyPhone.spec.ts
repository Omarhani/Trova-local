import { expect, test } from '@playwright/test';
import { KeptPhone } from '../../src/phone/keptPhone';
import { BlockPhoneDeps, phoneForBlock } from '../../src/phone/phoneForBlock';
import { Phone } from '../../src/phone/phoneSession';

/**
 * Round 2 review (test partner): opening the phone early must not change a result. A block that keeps the app's data
 * finds the app opened BEFORE the earlier blocks made their records - it must still show them (the app started again).
 */

const EARLY: KeptPhone = { runId: '9002', sessionId: 's-early', filmPort: 5300, capabilities: { platformName: 'Android' }, fresh: true };

function deps(kept: KeptPhone): { d: BlockPhoneDeps; log: string[] } {
  const log: string[] = [];
  const phone = (name: string): Phone => ({ sessionId: name }) as unknown as Phone;
  const d: BlockPhoneDeps = {
    kept: () => kept,
    attach: async (k) => { log.push(`attach ${k.sessionId}`); return phone(k.sessionId); },
    open: async (port, keep) => { log.push(`open ${port} keep=${keep}`); return phone('s-new'); },
    freePort: async () => 5200,
    save: (p, port) => log.push(`save ${p.sessionId} ${port}`),
    forget: () => log.push('forget'),
    reset: async (p, keep) => { log.push(`reset ${p.sessionId} keep=${keep}`); },
    end: async (p) => { log.push(`end ${p.sessionId}`); },
  };
  return { d, log };
}

test("a first phone block that keeps the app's data starts the app again on the early session - it sees the earlier blocks' records", async () => {
  const { d, log } = deps(EARLY);
  await phoneForBlock(true, d);
  expect(log).toContain('reset s-early keep=true');
});

test('run 718: the early app already on its sign-in screen is not started again - a sign-in screen shows nothing old (20 s saved)', async () => {
  const { d, log } = deps(EARLY);
  d.onSignIn = async () => true;
  await phoneForBlock(true, d);
  expect(log.some((l) => l.startsWith('reset'))).toBe(false);
});

test('the early app on any other screen (signed in from before) is still started again', async () => {
  const { d, log } = deps(EARLY);
  d.onSignIn = async () => false;
  await phoneForBlock(true, d);
  expect(log).toContain('reset s-early keep=true');
});
