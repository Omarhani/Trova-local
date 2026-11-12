import { expect, test } from '@playwright/test';
import { dayPlus } from '../../src/data/overtimeDays';

test('a day ahead is the local date, yyyy-MM-dd, across a month and a year', () => {
  expect(dayPlus(1, new Date(2026, 0, 31))).toBe('2026-02-01');
  expect(dayPlus(2, new Date(2026, 11, 31))).toBe('2027-01-02');
  expect(dayPlus(0, new Date(2026, 10, 9))).toBe('2026-11-09');
});
