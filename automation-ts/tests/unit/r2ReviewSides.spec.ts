import { errors, expect, Page, test } from '@playwright/test';
import { needsPhone } from '../../src/phone/appiumServer';
import { CaseTries } from '../../src/report/caseTries';
import { preRunCheck } from '../../src/run/preRunCheck';
import { needsWeb, SuitePlan } from '../../src/run/suitePlan';
import { SIGNED_OUT, SignedOutStep } from '../../src/web/signin/signedOutStep';

/** Round 2 review (test partner): the run's sides - the pre-run check, the sign-out keeper and the device chips. */

const block = (name: string, groups: string[], spec: string) => ({ name, params: {}, groups, tests: [{ spec, method: '' }] });
const plan = (...blocks: SuitePlan['blocks']): SuitePlan => ({ name: 's', params: {}, blocks });

test('a web-only run with no phone connected is never stopped by the phone check', async () => {
  const web = plan(block('Log in', ['Web'], 'tests/web/a.spec.ts'), block('Set up - x', [], 'tests/api/a.spec.ts'));
  expect(needsPhone(web)).toBe(false);
  const r = await preRunCheck({
    webLogins: [], needsPhone: needsPhone(web), look: () => ({ kind: 'none' }),
    phone: async () => 'No phone is connected to this computer', appium: async () => 'The phone server (Appium) does not answer',
    app: async () => null, now: () => 0,
  });
  expect(r.stops).toEqual({});
});

test('an API + phone run shows only its phone: no browser is started or said', () => {
  const mixed = plan(block('Set up - x', [], 'tests/api/a.spec.ts'), block('Leave', ['Mob'], 'tests/mobile/b.spec.ts'));
  expect(needsWeb(mixed)).toBe(false);
  expect(needsPhone(mixed)).toBe(true);
});

test('a sign-out met in a clean-up step is BLOCKED with its reason, never tried again and never hidden', async () => {
  const page = {} as Page;
  let again = 0;
  const guard = new SignedOutStep(async () => null);
  guard.watch(page, { signedOut: async () => true, signInAgain: async () => { again++; } }, () => 'https://app.x/plans');
  const err = await guard.once(page, async () => { throw new errors.TimeoutError('locator.click: Timeout 5000ms exceeded'); })
    .catch((e: Error) => e);
  expect(again).toBe(0);
  const d = new Map<string, boolean>();
  const tries = new CaseTries({ allow: (id) => { d.set(id, true); }, keep: (id) => { d.set(id, false); }, allowed: (id) => d.get(id) === true });
  const out = tries.ends('cleanUp', { status: 'failed', errors: [`${err.name}: ${err.message}`], annotations: [], retry: 0, retries: 1 });
  expect(out.end).toEqual({ status: 'blocked', msg: SIGNED_OUT });
  expect(d.get('cleanUp')).toBe(false);
});
