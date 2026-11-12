import { expect, test } from '@playwright/test';
import { AppClock, dayAt, offsetOfStamp, wallAt } from '../../src/data/appClock';
import { dmy } from '../../src/data/leaveDay';
import { dayPlus } from '../../src/data/overtimeDays';
import { daysAround, savedCheckInDay, todaysMovements } from '../../src/api/services/movementDays';
import { dayChangedReason } from '../../src/data/appDayChange';

/** runs 1025 / 1026: the computer at 23:30 on 12/11 (UTC+2), the app's account on UTC+3 - already 13/11 there */
const AT_2330_CAIRO = Date.UTC(2026, 10, 12, 21, 30);
const KSA = 180;
const CAIRO = 120;

test('the app\'s day is the day on its own clock, not the computer\'s', () => {
  expect(dayAt(AT_2330_CAIRO, KSA)).toBe('2026-11-13');
  expect(dayAt(AT_2330_CAIRO, CAIRO)).toBe('2026-11-12');
  expect(dmy(wallAt(AT_2330_CAIRO, KSA))).toBe('13/11/2026');
});

test('run 1025: the submission date expected is the app\'s day (13/11), so the trap day (12/11) still fails', () => {
  const clock = new AppClock('the app', () => KSA, () => AT_2330_CAIRO);
  expect(dmy(clock.wallNow())).toBe('13/11/2026');
  expect(dmy(clock.wallNow())).not.toBe('12/11/2026');
  expect(dayPlus(0, clock.wallNow())).toBe('2026-11-13');
  expect(dayPlus(1, clock.wallNow())).toBe('2026-11-14');
});

test('the clock is learned from the server\'s own stamp against the moment it was made (to the quarter hour)', () => {
  // run 1025: Leaves/Create sent at 21:05:26 UTC, the list gave CreatedDate "2026-11-13T00:05:26.88"
  expect(offsetOfStamp('2026-11-13T00:05:26.88', Date.UTC(2026, 10, 12, 21, 5, 26))).toBe(KSA);
  expect(offsetOfStamp('2026-11-12 23:09:33', Date.UTC(2026, 10, 12, 21, 9, 30))).toBe(CAIRO);
  expect(offsetOfStamp('not a time', AT_2330_CAIRO)).toBeUndefined();
  expect(offsetOfStamp('2026-11-20T00:05:00', AT_2330_CAIRO)).toBeUndefined(); // days away: not a clock, a wrong stamp
});

test('a clock keeps its fallback until the server tells it, and ignores an answer with no clock', () => {
  let account = KSA;
  const clock = new AppClock('attendance', () => account, () => AT_2330_CAIRO);
  expect(clock.offsetMin()).toBe(KSA);
  clock.learn(undefined);
  expect(clock.today()).toBe('2026-11-13');
  clock.learn(CAIRO);
  account = 0;
  expect(clock.today()).toBe('2026-11-12');
});

test('run 1026: the app check in at 23:09 is today\'s on its own clock (LocalTimeZone 120); yesterday\'s is not', () => {
  const rows = [
    { ID: 2, TransactionTypeID: 1, CreateDate: '2026-11-12T23:09:33.823', LocalTimeZone: CAIRO },
    { ID: 1, TransactionTypeID: 1, CreateDate: '2026-11-11T23:09:00', LocalTimeZone: CAIRO },
    { ID: 2, TransactionTypeID: 1, CreateDate: '2026-11-12T23:09:33.823', LocalTimeZone: CAIRO }, // the same row from a second day's list
  ];
  expect(todaysMovements(rows, AT_2330_CAIRO, KSA)).toEqual([{ kind: 'check in', time: '23:09' }]);
  expect(todaysMovements([{ ID: 3, TransactionTypeID: 1, CreateDate: '2026-11-13T00:09:00' }], AT_2330_CAIRO, KSA))
    .toEqual([{ kind: 'check in', time: '00:09' }]); // no clock on the row: the fallback clock's day
  expect(daysAround(AT_2330_CAIRO, KSA)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
});

test('run 1026: a saved check in on another day than the app\'s is BLOCKED with a plain reason; the same day is not', () => {
  const why = dayChangedReason('2026-11-12', '2026-11-13');
  expect(why).toContain('The app does not allow a check in at this hour - its day changed');
  expect(why).toContain('12/11/2026');
  expect(why).toContain('13/11/2026');
  expect(dayChangedReason('2026-11-12', '2026-11-12')).toBeUndefined(); // the trap: same day, home wrong = FAILED
  expect(dayChangedReason(undefined, '2026-11-13')).toBeUndefined(); // nothing saved = FAILED
});

test('run 1026: only the case\'s own saved check in tells its day - an older one of the run never counts', () => {
  const tapped = Date.UTC(2026, 10, 12, 21, 8, 0); // 23:08 on the gate's clock
  const older = { ID: 1, TransactionTypeID: 1, CreateDate: '2026-11-12T22:40:10', LocalTimeZone: CAIRO };
  const own = { ID: 2, TransactionTypeID: 1, CreateDate: '2026-11-12T23:08:03.1', LocalTimeZone: CAIRO };
  const checkOut = { ID: 3, TransactionTypeID: 2, CreateDate: '2026-11-12T23:08:30', LocalTimeZone: CAIRO };
  expect(savedCheckInDay([older, own, checkOut], tapped)).toBe('2026-11-12');
  expect(savedCheckInDay([older, checkOut], tapped)).toBeUndefined(); // not saved = FAILED, never BLOCKED
  expect(savedCheckInDay([{ ...own, LocalTimeZone: undefined }], tapped)).toBeUndefined(); // no clock: cannot tell
});
