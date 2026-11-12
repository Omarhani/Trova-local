import { expect, test } from '@playwright/test';
import { clockOf, dayOf, dayShown, time24, usDate, workDayOf } from '../../src/data/workPlanValues';

const NOV_9 = new Date(2026, 10, 9);

test('"tomorrow" or empty is the next local day, a date stays that date', () => {
  expect(dayOf('tomorrow', NOV_9)).toBe('2026-11-10');
  expect(dayOf(' Tomorrow ', new Date(2026, 11, 31))).toBe('2027-01-01');
  expect(dayOf('', NOV_9)).toBe('2026-11-10');
  expect(dayOf('2026-12-05', NOV_9)).toBe('2026-12-05');
});

test('"tomorrow" of a plan is the next working day: Friday and Saturday are skipped (run 893)', () => {
  expect(workDayOf('tomorrow', new Date(2026, 10, 11))).toBe('2026-11-12'); // Wednesday -> Thursday
  expect(workDayOf('tomorrow', new Date(2026, 10, 12))).toBe('2026-11-15'); // Thursday -> Sunday
  expect(workDayOf('', new Date(2026, 10, 13))).toBe('2026-11-15'); // Friday -> Sunday
  expect(workDayOf('tomorrow', new Date(2026, 10, 14))).toBe('2026-11-15'); // Saturday -> Sunday
  expect(workDayOf('tomorrow', new Date(2026, 11, 31))).toBe('2027-01-03'); // Thursday over the year end
  expect(workDayOf('2026-11-13', NOV_9)).toBe('2026-11-13'); // a date asked for stays that date
});

test('a time in words becomes 24-hour time', () => {
  expect(time24('10:00 am')).toBe('10:00');
  expect(time24('05:00 pm')).toBe('17:00');
  expect(time24('6 pm')).toBe('18:00');
  expect(time24('12:30 am')).toBe('00:30');
  expect(time24('12:15 pm')).toBe('12:15');
});

test('the shift list wants the day as MM/dd/yyyy', () => {
  expect(usDate('2026-11-09')).toBe('11/09/2026');
});

test('the form date "9/11/2026" and "09/11/2026" are the same day; a non-date is undefined', () => {
  expect(dayShown('9/11/2026')).toBe('2026-11-09');
  expect(dayShown('09/11/2026')).toBe('2026-11-09');
  expect(dayShown('١٠ نوفمبر')).toBeUndefined();
  expect(dayShown('')).toBeUndefined();
});

test('the clock face: hour and minute labels, AM / PM and what the field shows after', () => {
  expect(clockOf('10:00 am')).toEqual({ hour: '10', minute: '00', period: 'AM', shows: '10:00 am' });
  expect(clockOf('05:00 pm')).toEqual({ hour: '5', minute: '00', period: 'PM', shows: '5:00 pm' });
  expect(clockOf('6 pm')).toEqual({ hour: '6', minute: '00', period: 'PM', shows: '6:00 pm' });
  expect(clockOf('08:30 pm')).toEqual({ hour: '8', minute: '30', period: 'PM', shows: '8:30 pm' });
});
