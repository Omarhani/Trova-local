import { NewEmployee } from '../../../src/data/newEmployee';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { Phone } from '../../../src/phone/phoneSession';
import { AttendanceScreen } from '../../../src/phone/screens/AttendanceScreen';
import { HomeAccount } from '../../../src/phone/screens/HomeAccount';
import { HomeScreen } from '../../../src/phone/screens/HomeScreen';
import { signInAs } from './employeeOnPhone';

/**
 * Check in and check out on the app as the run's employee - the steps of the Java FullHybridCycle phone block, shared by
 * the phone cases and the hybrid suite's set-up. part names the lines ("Check in", "Set-up").
 */

/** home as the run's employee: the app's kept sign-in, else the run's one sign-in on its screens */
export async function homeAs(phone: Phone, e: NewEmployee): Promise<HomeScreen> {
  if (!(await new HomeAccount(phone).isShown(20))) await signInAs(phone, e);
  return new HomeScreen(phone);
}

/** Check-In > the attendance button > the app's answer > home on Check-Out with "Check in" as the last activity */
export async function checkInOnTheApp(home: HomeScreen, attendance: AttendanceScreen, part: string): Promise<void> {
  await home.waitUntilReadyToCheckIn();
  await home.openCheckIn();
  checkEquals(`${part} · the app says it was saved`, await attendance.submit(), 'success');
  await attendance.backToHomeIfShown();
  await home.waitUntilCheckOutIsAvailable();
  checkTrue(`${part} · home shows "Check in" as the last activity`, await home.checkInLastActivityIsShown());
}

/** Check-Out > the attendance button > the app's answer > home on Check-In with "Check out" as the last activity */
export async function checkOutOnTheApp(home: HomeScreen, attendance: AttendanceScreen, part: string): Promise<void> {
  await home.openCheckOut();
  checkEquals(`${part} · the app says it was saved`, await attendance.submit(), 'success');
  await attendance.backToHomeIfShown();
  await home.waitUntilCheckInIsAvailable();
  checkTrue(`${part} · home shows "Check out" as the last activity`, await home.checkOutLastActivityIsShown());
}
