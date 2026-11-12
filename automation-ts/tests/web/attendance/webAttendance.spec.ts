import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { fullName, NewEmployee } from '../../../src/data/newEmployee';
import { time24 } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { blockedSkip } from '../../../src/report/blockedSkip';
import { checkEquals } from '../../../src/report/checks';
import { AttendanceReportPage } from '../../../src/web/pages/AttendanceReportPage';
import { TransactionsPage } from '../../../src/web/pages/TransactionsPage';
import { webTest as test } from '../../../src/web/webTest';
import { movementsOn, sideOfRun, timesBecome, timesOf, today, transactions, userIdOf } from '../../api/attendance/movementsOfRun';
import { checkReportFigures, reportFiguresExpected } from './reportFigures';

/**
 * A check in and a check out the admin adds on the web for the run's employee, and the report of the day - the TS twins
 * of tests.web.attendanceReport.AttendanceCalculationTests (verifyThatTheUserCanCheckInAndOutFromWeb,
 * verifyThatCheckInAndOutFromWebAppearCorrectly; web/webReportExport passed on Test 5/5 and Stage 5/5, 2026-09-28,
 * web/webTestReports 4/4 on both). Only the run's own employee (made by API) is touched; its movements go with it in
 * the clean-up.
 */

/** the web check in and out of today: the run's own; else added now by API (the report case run alone) */
async function webMovementsOfToday(e: NewEmployee, checkIn: string, checkOut: string): Promise<void> {
  const made = await movementsOn(e);
  const api = await transactions();
  const userId = await userIdOf(e);
  if (timesOf(made, 'check in').length === 0) await api.add(userId, 'check in', today(), checkIn);
  if (timesOf(made, 'check out').length === 0) await api.add(userId, 'check out', today(), checkOut);
}

test('testVerifyThatTheAdminCanAddACheckInAndOutForTheEmployeeFromTheWeb', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const checkIn = time24(param('check_in', '9:00 am'));
  const checkOut = time24(param('check_out', '6:00 pm'));
  const side = await sideOfRun(e); // case 529: the side with gates found once by API, never tried side by side on screen
  if (!side) blockedSkip(test.info(), 'data', "Not tested - needs a department with gates: none of the employee's departments has a gate");

  const moves = new TransactionsPage(page);
  await moves.openTransactions();
  await moves.showDay(today());
  await moves.showEmployee(e.jobNumber, fullName(e));
  await moves.addCheckIn(param('check_in', '9:00 am'), side);
  await moves.addCheckOut(param('check_out', '6:00 pm'), side);

  checkEquals('Transactions · the check in shown for today', await moves.timesOf(fullName(e), 'check in'), [checkIn]);
  checkEquals('Transactions · the check out shown for today', await moves.timesOf(fullName(e), 'check out'), [checkOut]);
  checkEquals("API · the employee's check in today", await timesBecome(e, 'check in', [checkIn]), [checkIn]);
  checkEquals("API · the employee's check out today", await timesBecome(e, 'check out', [checkOut]), [checkOut]);
});

test('testVerifyThatTheReportShowsTheCheckInAndOutAddedOnTheWeb', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const expected = reportFiguresExpected();
  await webMovementsOfToday(e, expected.checkIn, expected.checkOut);

  const report = new AttendanceReportPage(page);
  await report.openReport();
  await report.showDay(today());
  await report.showEmployee(e.jobNumber, fullName(e));

  checkReportFigures(await report.figures(), expected);
});
