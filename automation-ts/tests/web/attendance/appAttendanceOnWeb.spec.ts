import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { fullName, NewEmployee } from '../../../src/data/newEmployee';
import { time24 } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { blockedSkip } from '../../../src/report/blockedSkip';
import { checkEquals } from '../../../src/report/checks';
import { AttendanceReportPage } from '../../../src/web/pages/AttendanceReportPage';
import { TransactionsPage } from '../../../src/web/pages/TransactionsPage';
import { webTest as test } from '../../../src/web/webTest';
import { movementsOn, timesBecome, today } from '../../api/attendance/movementsOfRun';
import { appMovementsMissing } from './appMovementsNeeded';
import { checkReportFigures, reportFiguresExpected } from './reportFigures';

/**
 * The app's check in and check out of the run's employee, on the admin's web - the TS twins of the web blocks of
 * tests.hybrid.cycle.FullHybridCycle (verifyThatAdminCanUpdateCheckInAndOutFromWeb, verifyThatCheckInAndOutFromMobileAppearCorrectly;
 * hybrid/fullHybridCycleCheckInAndOut passed on Test 5/5 and Stage 5/5, 2026-09-26). Set-up: the run's employee checked
 * in and out on the app today ("Set-up - check in and out on the app" - an app check in has no call a run may make).
 */

/** the case's record: today's app check in and check out of the run's employee, else the case is skipped (BLOCKED, data) */
async function requireAppMovements(e: NewEmployee): Promise<void> {
  const missing = appMovementsMissing(await movementsOn(e));
  if (missing) blockedSkip(test.info(), 'data', missing);
}

test('testVerifyThatTheAdminCanUpdateTheAppCheckInAndOutFromTheWeb', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  await requireAppMovements(e);
  const checkIn = time24(param('check_in', '9:00 am'));
  const checkOut = time24(param('check_out', '6:00 pm'));

  const moves = new TransactionsPage(page);
  await moves.openTransactions();
  await moves.showDay(today());
  await moves.showEmployee(e.jobNumber, fullName(e));
  await moves.setCheckInAndOut(param('check_in', '9:00 am'), param('check_out', '6:00 pm'));

  checkEquals('Transactions · the check in shown after the update', await moves.timesOf(fullName(e), 'check in'), [checkIn]);
  checkEquals('Transactions · the check out shown after the update', await moves.timesOf(fullName(e), 'check out'), [checkOut]);
  checkEquals("API · the employee's check in today", await timesBecome(e, 'check in', [checkIn]), [checkIn]);
  checkEquals("API · the employee's check out today", await timesBecome(e, 'check out', [checkOut]), [checkOut]);
});

test('testVerifyThatTheReportShowsTheUpdatedCheckInAndOut', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  await requireAppMovements(e);

  const report = new AttendanceReportPage(page);
  await report.openReport();
  await report.showDay(today());
  await report.showEmployee(e.jobNumber, fullName(e));

  checkReportFigures(await report.figures(), reportFiguresExpected());
});
