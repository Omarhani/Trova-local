import { expect, test } from '@playwright/test';
import { checkTrue } from '../../src/report/checks';
import { LIVE } from '../../src/report/liveEvents';
import { nextStep } from '../../src/report/stepNumbers';
import { PhoneActions } from '../../src/phone/phoneActions';
import { Phone } from '../../src/phone/phoneSession';

/** the live events printed while run() works */
async function said(run: () => Promise<void> | void): Promise<Record<string, unknown>[]> {
  const out: string[] = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = write;
  }
  return out.filter((l) => l.startsWith(LIVE)).map((l) => JSON.parse(l.slice(LIVE.length)) as Record<string, unknown>);
}

// Omar 2026-11-10: a check on the run screen had no number - checks count in the same sequence as steps (step 5, check 6, step 7)
test('a check gets the next number of the same sequence as the steps', async () => {
  const before = nextStep();
  const [check] = await said(() => checkTrue('Sign-in · home shows', true));
  expect(check).toMatchObject({ t: 'check', ok: true, n: before + 1 });
  expect(nextStep()).toBe(before + 2);
});

class Tapper extends PhoneActions {
  press(selector: string) {
    return this.tap(selector, 1, 'Sign in');
  }
}

// Omar 2026-11-10: "tap" reads like "tab" - a phone tap is said as "click", as the Java phone steps say it
test('a phone tap is said as a click on the run screen, numbered in the same sequence', async () => {
  const xml = '<hierarchy><node resource-id="app:id/login" bounds="[0,0][100,50]" /></hierarchy>';
  const phone = { getPageSource: async () => xml, execute: async () => '' } as unknown as Phone;
  const before = nextStep();
  const events = await said(() => new Tapper(phone).press('//*[@resource-id="login"]'));
  expect(events.filter((e) => e.t === 'step')).toEqual([expect.objectContaining({ a: 'click', e: 'Sign in', n: before + 1 })]);
});
