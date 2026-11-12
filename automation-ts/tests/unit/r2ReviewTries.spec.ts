import { expect, test } from '@playwright/test';
import { Attempt, CaseTries } from '../../src/report/caseTries';
import { retryGate } from '../../src/run/caseGuard';

/** Round 2 review (test partner): failure kinds and the one more try - edge cases. */

function book() {
  const d = new Map<string, boolean>();
  return { allow: (id: string) => { d.set(id, true); }, keep: (id: string) => { d.set(id, false); }, allowed: (id: string) => d.get(id) === true };
}

const at = (over: Partial<Attempt>): Attempt => ({ status: 'failed', errors: [], annotations: [], retry: 0, retries: 1, ...over });

test('a set-up problem is tried exactly once more, even when the run allows more tries', () => {
  const b = book();
  const tries = new CaseTries(b);
  tries.ends('t', at({ errors: ['TypeError: fetch failed'], retries: 2 }));
  const second = tries.ends('t', at({ errors: ['TypeError: fetch failed'], retry: 1, retries: 2 }));
  expect(second.end?.status).toBe('blocked');
  expect(retryGate(2, b.allowed('t'))).toBeDefined(); // a third try only steps aside
});

test('in one block a FAILED case is never run again while the blocked case beside it gets its one more try', () => {
  const b = book();
  const tries = new CaseTries(b);
  expect(tries.ends('blocked', at({ errors: ['WebDriverError: invalid session id'] })).note).toContain('once more');
  expect(tries.ends('wrong', at({ errors: ['Error: Approve · status - expected "Approved", seen "Pending" ✗'] })).end?.status).toBe('fail');
  expect(retryGate(1, b.allowed('blocked'))).toBeUndefined();
  expect(retryGate(1, b.allowed('wrong'))).toContain('first try stands');
  expect(tries.ends('wrong', at({ status: 'skipped', retry: 1 }))).toEqual({}); // the FAILED row is not touched
  expect(tries.ends('blocked', at({ status: 'passed', retry: 1 })).end?.status).toBe('pass');
});

test("a network break during the run's one sign-in is a set-up problem: tried once more, not a refused sign-in", () => {
  const b = book();
  const out = new CaseTries(b).ends('s', at({ errors: ['SignInProblem: fetch failed'] }));
  expect(out.end).toBeUndefined();
  expect(out.note).toContain('once more');
  expect(b.allowed('s')).toBe(true);
});

test('a BLOCKED reason never shows a token the error carried (the reporter does not know the run\'s secrets)', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.c2lnbmF0dXJlLXZhbHVl';
  const tries = new CaseTries(book());
  const signIn = tries.ends('s', at({ retries: 0, errors: [
    `SignInProblem: apiRequestContext.get: read ECONNRESET\nCall log:\n  - → GET https://app.example/api/Profile\n  -   authorization: Bearer ${jwt}`] }));
  expect(signIn.end?.status).toBe('blocked');
  expect(JSON.stringify(signIn)).not.toContain(jwt);
  const link = tries.ends('n', at({ errors: ['Error: page.goto: net::ERR_CONNECTION_RESET at https://app.example/reset-password?token=Q7xK2mP9vL4sT8wZ'] }));
  expect(link.note).toContain('could not be reached');
  expect(JSON.stringify(link)).not.toContain('Q7xK2mP9vL4sT8wZ');
});
