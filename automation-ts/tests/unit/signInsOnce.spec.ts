import { expect, test } from '@playwright/test';
import { runSignInBook } from '../../src/signin/runSignInBook';
import { signIn } from '../../src/signin/signIns';
import { SkipLogin } from '../../src/signin/skipLogin';

/** The run's API sign-in: never in full screen mode, never again for a login the app refused this run. */
const before = { run: process.env.TROVA_RUN_ID, mode: process.env.TROVA_MODE };

test.beforeEach(() => {
  process.env.TROVA_RUN_ID = `unit-once-${process.pid}-${Date.now()}`;
});

test.afterEach(() => {
  runSignInBook.forget();
  for (const [k, v] of [['TROVA_RUN_ID', before.run], ['TROVA_MODE', before.mode]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('full screen mode never signs in by the app\'s API: sign-in and clean-up go through the screens', async () => {
  process.env.TROVA_MODE = 'ui';
  await expect(signIn('Admin', 'web')).rejects.toThrow('This suite runs in full screen mode');
});

test('a login the app refused earlier in the run is skipped at once, with no sign-in call', async () => {
  runSignInBook.refuse('Admin', "The app refused the saved sign-in of Admin (its calls answered 401) - check the app's sign-in on the server");
  const started = Date.now();
  const e = await signIn('Admin', 'web').catch((x: unknown) => x);
  expect(e).toBeInstanceOf(SkipLogin);
  expect((e as Error).message).toContain('its calls answered 401');
  expect(Date.now() - started).toBeLessThan(1000);
});
