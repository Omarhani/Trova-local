import { expect, test } from '@playwright/test';
import { appMovementsMissing } from '../web/attendance/appMovementsNeeded';

/**
 * Test 8094 run 1001 (suite 68, cases 4228 / 4229): the app's check out case before them failed, so the employee had no
 * check out today, and both web cases FAILED on their set-up. A case that needs an earlier case's record says so and is
 * skipped (BLOCKED, data) with a plain reason - the earlier failure is the one that counts.
 */
test('red first (run 1001): no check out on the app today = a plain "not tested" reason naming the cases it needs', () => {
  expect(appMovementsMissing([{ kind: 'check in', time: '21:45' }])).toBe(
    "Not tested - needs the employee's check in and check out on the app today, made by the app check in and check out cases before it (one of them did not pass)");
});

test('no movement at all today is the same reason', () => {
  expect(appMovementsMissing([])).toContain('Not tested - needs');
});

test('a check in and a check out today: the case runs', () => {
  expect(appMovementsMissing([{ kind: 'check in', time: '21:45' }, { kind: 'check out', time: '21:46' }])).toBeUndefined();
});
