import { expect, test } from '@playwright/test';
import { kindOf } from '../../src/report/failureKind';
import { notOpened } from '../../src/web/notOpened';

/**
 * Test 8094 runs 865 / 866 (5 web runs at once, the app slow): "The Work plans page did not open within 20 s" was FAILED.
 * A page of the app that did not open in time is the environment - Not checked; an error the app showed stays FAILED.
 */
const kind = (e: Error): string => kindOf(`${e.name}: ${e.message}`).kind;

test('a page that did not open in time and the app showed nothing wrong: Not checked (slow), in plain words', () => {
  const e = notOpened('The Work plans page', 20, { statuses: [], message: '' });
  expect(e.name).toBe('SlowAnswer');
  expect(e.message).toBe('The Work plans page did not open within 20 s - not the app\'s answer');
  expect(kind(e)).toBe('slow');
});

test('the app showed an error message while the page was opening: FAILED with Expected / Actual', () => {
  const e = notOpened('The Work plans page', 20, { statuses: [], message: 'حدث خطأ ما' });
  expect(e.message).toBe('Expected: The Work plans page opens / Actual: the app showed "حدث خطأ ما"');
  expect(kind(e)).toBe('failed');
});

test('the app\'s own call answered a server error while the page was opening: FAILED', () => {
  const e = notOpened('The Work plans page', 20, { statuses: [200, 500], message: '' });
  expect(e.message).toBe('Expected: The Work plans page opens / Actual: the app answered with an error (500)');
  expect(kind(e)).toBe('failed');
});

test('boundary: answers below 500 (a not found, a sign-out) are not the app failing the page - still Not checked', () => {
  expect(notOpened('The Invoices page', 20, { statuses: [404, 401, 403, 499], message: '' }).name).toBe('SlowAnswer');
});

test('a blank message (spaces only) is no app message', () => {
  expect(notOpened('The Invoices page', 30, { statuses: [], message: '   ' }).name).toBe('SlowAnswer');
});
