import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { checkEquals } from '../../../src/report/checks';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { AttendanceScreen } from '../../../src/phone/screens/AttendanceScreen';
import { countBecomes, timesOf, movementsOn } from '../../api/attendance/movementsOfRun';
import { checkInOnTheApp, checkOutOnTheApp, homeAs } from './appAttendance';

/**
 * The run's employee checks in and out on the app - the TS twin of the phone block of tests.hybrid.cycle.FullHybridCycle
 * (verifyThatUserCanLoginSuccessfullyWithValidCredentialsWithCheckInAndOut; hybrid/fullHybridCycleCheckInAndOut passed
 * on Test 5/5 and Stage 5/5, 2026-09-26). The app keeps the run's one sign-in of the employee; every check in or out is
 * proved by the admin's API as well. The movements go with the employee the clean-up deletes.
 */
test('testVerifyThatTheEmployeeCanCheckInFromTheApp', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = await homeAs(phone, e);
  const before = timesOf(await movementsOn(e), 'check in').length;

  await checkInOnTheApp(home, new AttendanceScreen(phone), 'Check in');
  checkEquals("API · the employee's check ins today went up by 1", await countBecomes(e, 'check in', before + 1), before + 1);
});

test('testVerifyThatTheEmployeeCanCheckOutFromTheApp', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = await homeAs(phone, e);
  const attendance = new AttendanceScreen(phone);
  // set-up: the case's own check in when the run left none open (a case run alone)
  if (!(await home.offersCheckOut())) await checkInOnTheApp(home, attendance, 'Set-up');
  const before = timesOf(await movementsOn(e), 'check out').length;

  await checkOutOnTheApp(home, attendance, 'Check out');
  checkEquals("API · the employee's check outs today went up by 1", await countBecomes(e, 'check out', before + 1), before + 1);
});

/** hybrid set-up on the screens (the app's own check in has no call a run may make): one check in and one check out */
test('checkedInAndOutOnTheApp', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = await homeAs(phone, e);
  const attendance = new AttendanceScreen(phone);
  if (!(await home.offersCheckOut())) await checkInOnTheApp(home, attendance, 'Set-up check in');
  await checkOutOnTheApp(home, attendance, 'Set-up check out');
  const movements = await movementsOn(e);
  checkEquals('Set-up · API: the app check in and check out of today are there',
    [timesOf(movements, 'check in').length > 0, timesOf(movements, 'check out').length > 0], [true, true]);
});
