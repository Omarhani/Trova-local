import { expect, test } from '@playwright/test';
import { checkFalse } from '../../src/report/checks';

test('checkFalse passes on false', () => {
  expect(() => checkFalse('Save stays disabled', false)).not.toThrow();
});

test('checkFalse fails on true and names the check', () => {
  expect(() => checkFalse('Save stays disabled', true)).toThrow(/Save stays disabled/);
});
