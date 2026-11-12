import { expect, test } from '@playwright/test';
import { checkContains, checkEquals, checkTrue } from '../../src/report/checks';

/** Omar's rule: a failed check reads "<what> - expected "…", seen "…" ✗" - never Playwright's "Expected: true Received: false" */
function failure(run: () => void): string {
  try {
    run();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return 'no failure';
}

test('a failed equals check says what, expected and seen in plain words', () => {
  const said = failure(() => checkEquals('Calendar · the new shift', 'no shift', 'Omar WebShift'));
  expect(said).toBe('Calendar · the new shift - expected "Omar WebShift", seen "no shift" ✗');
});

test('a failed contains check says what it looked for and what it saw', () => {
  const said = failure(() => checkContains('Toast', 'Saved', 'Deleted'));
  expect(said).toBe('Toast - expected to contain "Deleted", seen "Saved" ✗');
});

test('a failed yes / no check keeps the app\'s reason and no "Received"', () => {
  const said = failure(() => checkTrue('Approve · the app took it', false, 'not allowed'));
  expect(said).toBe('Approve · the app took it ✗ - not allowed');
  expect(said).not.toMatch(/Received|Expected:/);
});

test('a passed check throws nothing', () => {
  expect(failure(() => checkEquals('x', 1, 1))).toBe('no failure');
});
