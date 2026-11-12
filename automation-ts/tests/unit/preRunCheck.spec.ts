import { expect, test } from '@playwright/test';
import { PreRunDeps, preRunCheck } from '../../src/run/preRunCheck';

/** Round 2: once per run, at most 10 s - a problem stops the cases it touches at once, with one reason. */

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 11, 1, 0);

function deps(over: Partial<PreRunDeps> = {}): PreRunDeps {
  return {
    webLogins: ['Admin'], needsPhone: true,
    look: () => ({ kind: 'ready', signIn: { origin: 'x', browser: { localStorage: {}, sessionStorage: {}, cookies: {} }, savedAt: NOW - HOUR, endsAt: NOW + 2 * HOUR } }),
    phone: async () => null, appium: async () => null, app: async () => null, now: () => NOW,
    ...over,
  };
}

test('all well: no stop, no refusal, no warning', async () => {
  const r = await preRunCheck(deps());
  expect(r).toMatchObject({ stops: {}, refused: [], warnings: [] });
});

test('a saved web sign-in that has ended stops that login at once; one that ends within 30 min is a warning with its clock time', async () => {
  const ended = await preRunCheck(deps({ look: () => ({ kind: 'ended', why: 'The saved browser sign-in of Admin has ended' }) }));
  expect(ended.refused).toEqual([{ login: 'Admin', why: 'The saved browser sign-in of Admin has ended' }]);
  const soon = await preRunCheck(deps({ look: () => ({ kind: 'ready', signIn: { origin: 'x', browser: { localStorage: {}, sessionStorage: {}, cookies: {} }, savedAt: 0, endsAt: NOW + 20 * 60_000 } }) }));
  expect(soon.refused).toEqual([]);
  expect(soon.warnings.join()).toMatch(/web sign-in of Admin ends at \d\d:\d\d/);
  const none = await preRunCheck(deps({ look: () => ({ kind: 'none' }) }));
  expect(none).toMatchObject({ refused: [], warnings: [] }); // no saved file: the run signs in its own way
});

test('the phone, its server and the app: each problem is one stop with its own reason', async () => {
  const r = await preRunCheck(deps({ phone: async () => 'The phone is locked', appium: async () => null, app: async () => null }));
  expect(r.stops).toEqual({ phone: 'The phone is locked' });
  const down = await preRunCheck(deps({ appium: async () => 'The phone server (Appium) does not answer' }));
  expect(down.stops.phone).toContain('Appium');
  const app = await preRunCheck(deps({ app: async () => "The app's server could not be reached" }));
  expect(app.stops.app).toContain('could not be reached');
});

test('a suite without phone cases never looks at the phone', async () => {
  let looked = false;
  const r = await preRunCheck(deps({ needsPhone: false, phone: async () => { looked = true; return 'x'; }, appium: async () => { looked = true; return 'x'; } }));
  expect(looked).toBe(false);
  expect(r.stops).toEqual({});
});

test('a look that does not answer is cut at the limit: the whole check stays within it', async () => {
  const started = Date.now();
  const r = await preRunCheck(deps({ phone: () => new Promise<string | null>(() => undefined) }), 300);
  expect(Date.now() - started).toBeLessThan(1500);
  expect(r.stops.phone).toContain('did not answer');
});
