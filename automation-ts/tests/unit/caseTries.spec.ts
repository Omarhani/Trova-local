import { expect, test } from '@playwright/test';
import { Attempt, CaseTries } from '../../src/report/caseTries';
import { KIND_NOTE } from '../../src/report/failureKind';

/** Round 2: a set-up problem is tried ONCE more and the run screen says so; a wrong app result is never tried again. */

function book() {
  const d = new Map<string, boolean>();
  return { d, allow: (id: string) => { d.set(id, true); }, keep: (id: string) => { d.set(id, false); }, allowed: (id: string) => d.get(id) === true };
}

const at = (over: Partial<Attempt>): Attempt => ({ status: 'failed', errors: [], annotations: [], retry: 0, retries: 1, ...over });

test('a pass is a pass, a wrong app result is FAILED and its second try is never run', () => {
  const b = book();
  const tries = new CaseTries(b);
  expect(tries.ends('t1', at({ status: 'passed' }))).toEqual({ end: { status: 'pass', msg: '' } });
  const failed = tries.ends('t2', at({ errors: ['Error: Approve · toast - expected "a", seen "b" ✗'] }));
  expect(failed.end?.status).toBe('fail');
  expect(failed.note).toBeUndefined();
  expect(b.allowed('t2')).toBe(false);
  expect(tries.begins('t2', 1)).toBe(false);
  expect(tries.ends('t2', at({ status: 'skipped', retry: 1 }))).toEqual({}); // the kept first try: nothing more on the run screen
});

test('a set-up problem: no end on the first try, a note that says it runs once more, then ONE row with the final result', () => {
  const b = book();
  const tries = new CaseTries(b);
  expect(tries.begins('t', 0)).toBe(true);
  const first = tries.ends('t', at({ errors: ['TypeError: fetch failed'] }));
  expect(first.end).toBeUndefined();
  expect(first.note).toContain('once more');
  expect(first.note).toContain('could not be reached');
  expect(b.allowed('t')).toBe(true);
  expect(tries.begins('t', 1)).toBe(false); // the same row on the run screen
  const second = tries.ends('t', at({ status: 'passed', retry: 1 }));
  expect(second.end?.status).toBe('pass');
  expect(second.end?.msg).toContain('second try');
  expect(second.end?.msg).toContain('could not be reached');
});

test('a set-up problem on both tries is BLOCKED and says so; a wrong result on the second try is FAILED', () => {
  const tries = new CaseTries(book());
  tries.ends('a', at({ errors: ['WebDriverError: invalid session id'] }));
  const both = tries.ends('a', at({ errors: ['WebDriverError: invalid session id'], retry: 1 }));
  expect(both.end?.status).toBe('blocked');
  expect(both.end?.msg).toContain('both tries');
  tries.ends('b', at({ errors: ['TypeError: fetch failed'] }));
  const wrong = tries.ends('b', at({ errors: ['Error: Home greeting - expected "Welcome", seen "" ✗'], retry: 1 }));
  expect(wrong.end?.status).toBe('fail');
  expect(wrong.end?.msg).toContain('the first try was blocked');
});

test('no try left (the setting is off): a set-up problem is BLOCKED at once, never retried', () => {
  const b = book();
  const out = new CaseTries(b).ends('t', at({ errors: ['TypeError: fetch failed'], retries: 0 }));
  expect(out.end?.status).toBe('blocked');
  expect(b.allowed('t')).toBe(false);
});

test('a sign-in refusal and missing data are BLOCKED and never tried again (one sign-in per run)', () => {
  const b = book();
  const tries = new CaseTries(b);
  expect(tries.ends('s', at({ errors: ['SignInProblem: The app refused the saved sign-in of Admin'] })).end)
    .toEqual({ status: 'blocked', msg: 'The app refused the saved sign-in of Admin' });
  expect(b.allowed('s')).toBe(false);
  const skipped = tries.ends('d', at({
    status: 'skipped', skipReason: 'Not tested - needs a pending request made by this run',
    annotations: [{ type: KIND_NOTE, description: 'data' }],
  }));
  expect(skipped.end).toEqual({ status: 'blocked', msg: 'Not tested - needs a pending request made by this run' });
});

test('a plain skip (nothing was made, nothing to delete) stays a skip', () => {
  expect(new CaseTries(book()).ends('c', at({ status: 'skipped', skipReason: 'Nothing was made by this run - nothing to delete' })).end)
    .toEqual({ status: 'skip', msg: 'Nothing was made by this run - nothing to delete' });
});
