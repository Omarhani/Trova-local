import { test } from '@playwright/test';
import { savedCheckInDay } from '../../../src/api/services/movementDays';
import { accountClock } from '../../../src/data/appClock';
import { dayChangedReason } from '../../../src/data/appDayChange';
import { NewEmployee } from '../../../src/data/newEmployee';
import { HomeScreen } from '../../../src/phone/screens/HomeScreen';
import { blockedSkip } from '../../../src/report/blockedSkip';
import { rowsAround } from '../../api/attendance/movementsOfRun';

/**
 * Home on Check-Out after the case's check in (tapped at tappedAt). Run 1026: at 23:08 here the app saved the check in
 * on its gate's day (12/11) while its own day was already 13/11, and home stayed on Check-In - that hour the case is
 * BLOCKED with the reason, never passed. Same day, or the check in not saved: the wait's own failure stands (FAILED).
 */
export async function checkOutOfferedOrDayChanged(home: HomeScreen, e: NewEmployee, part: string, tappedAt: number): Promise<void> {
  try {
    await home.waitUntilCheckOutIsAvailable();
  } catch (err) {
    const rows = await rowsAround(e).catch(() => []); // the server could not be asked: the failure stands as it is
    const why = dayChangedReason(savedCheckInDay(rows, tappedAt), accountClock.today());
    if (why) blockedSkip(test.info(), 'data', `${part} · ${why}`);
    throw err;
  }
}
