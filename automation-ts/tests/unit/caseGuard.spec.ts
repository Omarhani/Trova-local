import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { NO_CHECK, noCheckFailure, retryGate, stopFor } from '../../src/run/caseGuard';
import { RunStops } from '../../src/run/runStops';
import { checksMade, checkTrue } from '../../src/report/checks';

/** Round 2: what every TS case goes through before and after its own steps. */

test('a second try runs only when the reporter allowed it (set-up problem); else it steps aside', () => {
  expect(retryGate(0, false)).toBeUndefined();
  expect(retryGate(1, true)).toBeUndefined();
  expect(retryGate(1, false)).toContain('first try');
});

test("the run's pre-run stops reach the cases they touch: the app's server stops all, the phone only phone cases", () => {
  expect(stopFor('api', { app: 'server down' })).toBe('server down');
  expect(stopFor('web', { phone: 'locked' })).toBeUndefined();
  expect(stopFor('phone', { phone: 'locked' })).toBe('locked');
  expect(stopFor('phone', {})).toBeUndefined();
});

test('a case that passed without one check of its expected result is FAILED; a failed or skipped one is left as it is', () => {
  expect(noCheckFailure('passed', 3, 3)).toBe(NO_CHECK);
  expect(noCheckFailure('passed', 3, 4)).toBeUndefined();
  expect(noCheckFailure('failed', 3, 3)).toBeUndefined();
  expect(noCheckFailure('skipped', 0, 0)).toBeUndefined();
  expect(NO_CHECK).toContain('no check of the expected result');
});

test('every check counts, passed or not', () => {
  const before = checksMade();
  checkTrue('a check', true);
  expect(() => checkTrue('a wrong one', false)).toThrow();
  expect(checksMade()).toBe(before + 2);
});

test('the stops live in the run\'s own file, written once by the run\'s set-up and read by every block', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stops-')), 'run-stops-1.json');
  new RunStops(() => file).save({ phone: 'The phone is locked' });
  expect(new RunStops(() => file).read()).toEqual({ phone: 'The phone is locked' });
  new RunStops(() => file).forget();
  expect(new RunStops(() => file).read()).toEqual({});
});
