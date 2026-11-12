import { expect, test } from '@playwright/test';
import { blockNow } from '../../src/run/blockNow';
import { runSignInBook } from '../../src/signin/runSignInBook';
import { runSignIns } from '../../src/signin/runSignIns';
import { cleanUpSignIn } from '../../src/signin/cleanUpSignIn';
import { signIn, signInKey } from '../../src/signin/signIns';
import { SkipLogin } from '../../src/signin/skipLogin';

/**
 * Test 8094 run 973: case 529's web sign-in was stopped, then the clean-up block was BLOCKED in 62 ms with the same
 * reason and the run's employee stayed in the app. A clean-up by API always runs with the sign-in the run already holds.
 */
const before = process.env.TROVA_RUN_ID;
const STOPPED = 'The browser was slow - retried once, it was still slow';
const HELD = { token: 'run-973-held-token', browser: { localStorage: { USER_ID: '7' }, sessionStorage: {}, cookies: {} } };

test.beforeEach(() => {
  process.env.TROVA_RUN_ID = `unit-cleanup-${process.pid}-${Date.now()}`;
  runSignInBook.refuse('Admin', STOPPED);
});

test.afterEach(() => {
  blockNow.set(undefined);
  runSignInBook.forget();
  runSignIns.forget();
  if (before === undefined) delete process.env.TROVA_RUN_ID;
  else process.env.TROVA_RUN_ID = before;
});

test('the clean-up block signs in with the run\'s held sign-in although a case\'s sign-in was stopped', async () => {
  runSignIns.keep(signInKey('Admin', 'web'), HELD);
  blockNow.set('cleanup');
  const r = await signIn('Admin', 'web');
  expect(r.token).toBe(HELD.token);
});

test('a case block after the stopped sign-in is still skipped at once with its reason', async () => {
  runSignIns.keep(signInKey('Admin', 'web'), HELD);
  blockNow.set('case');
  const e = await signIn('Admin', 'web').catch((x: unknown) => x);
  expect(e).toBeInstanceOf(SkipLogin);
  expect((e as Error).message).toBe(STOPPED);
});

test('a clean-up with no sign-in held by the run is skipped with the reason - never a new sign-in call', async () => {
  blockNow.set('cleanup');
  const e = await signIn('Admin', 'web').catch((x: unknown) => x);
  expect(e).toBeInstanceOf(SkipLogin);
  expect((e as Error).message).toBe(STOPPED);
});

test('a clean-up whose held sign-in ended is skipped with the reason of the stop, and says nothing it holds', () => {
  const said: string[] = [];
  const e = (() => {
    try {
      return cleanUpSignIn('Admin', STOPPED, { role: () => 'cleanup', held: () => { throw new Error('ended'); }, say: (l) => said.push(l) });
    } catch (x) {
      return x;
    }
  })();
  expect(e).toBeInstanceOf(SkipLogin);
  expect([(e as Error).message, said]).toEqual([STOPPED, []]);
});
