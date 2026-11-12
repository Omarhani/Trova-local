import { expect, test } from '@playwright/test';
import { freeLeaveDay, monthsAhead, weekendOf, ymd } from '../../src/data/leaveDay';

/** Phone leave case (Omar 2026-11-11): a future working day the employee has no request on - never a fixed date. */
const TUE_10_NOV = new Date(2026, 10, 10, 23, 50);
const FRI_SAT = [5, 6];

test('the leave day is tomorrow when tomorrow is a free working day', () => {
  expect(ymd(freeLeaveDay([], TUE_10_NOV, FRI_SAT))).toBe('2026-11-11');
});

test('a day inside any listed request of the employee is skipped (from - to, both ends)', () => {
  const taken = [{ FromDate: '2026-11-11T00:00:00', ToDate: '2026-11-12T00:00:00' }];
  expect(ymd(freeLeaveDay(taken, TUE_10_NOV, FRI_SAT))).toBe('2026-11-15');
});

test('the weekend is skipped: Thursday taken -> Sunday, never Friday or Saturday', () => {
  const wed = new Date(2026, 10, 11);
  const taken = [{ FromDate: '2026-11-12T00:00:00', ToDate: '2026-11-12T00:00:00' }];
  expect(ymd(freeLeaveDay(taken, wed, FRI_SAT))).toBe('2026-11-15');
});

test('no weekend given: every day counts', () => {
  const thu = new Date(2026, 10, 12);
  expect(ymd(freeLeaveDay([], thu, []))).toBe('2026-11-13');
});

test('boundary: the last day of the month moves on to the next month', () => {
  const mon30 = new Date(2026, 10, 30);
  expect(ymd(freeLeaveDay([], mon30, FRI_SAT))).toBe('2026-12-01');
});

test('no free day within the limit: a plain error, never a guessed day', () => {
  const all = [{ FromDate: '2026-11-11T00:00:00', ToDate: '2027-03-01T00:00:00' }];
  expect(() => freeLeaveDay(all, TUE_10_NOV, FRI_SAT, 30)).toThrow('No free working day');
});

test('weekend words: short or long English day names, any case; empty = none', () => {
  expect(weekendOf('Fri,Sat')).toEqual([5, 6]);
  expect(weekendOf(' friday , SATURDAY ')).toEqual([5, 6]);
  expect(weekendOf('')).toEqual([]);
});

test('trap: an unknown weekend word stops the set-up instead of being dropped', () => {
  expect(() => weekendOf('Fri,Holiday')).toThrow('Holiday');
});

test('months ahead: the same month 0, the next 1, across the year end 1', () => {
  expect(monthsAhead(TUE_10_NOV, new Date(2026, 10, 30))).toBe(0);
  expect(monthsAhead(TUE_10_NOV, new Date(2026, 11, 1))).toBe(1);
  expect(monthsAhead(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1);
});
