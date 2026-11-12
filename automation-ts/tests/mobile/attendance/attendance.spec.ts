import { param } from '../../../src/run/blockParams';
import { credentials, runLogin } from '../../../src/run/credentials';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { Phone } from '../../../src/phone/phoneSession';
import { testData } from '../../../src/run/testData';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { AttendanceScreen } from '../../../src/phone/screens/AttendanceScreen';
import { HomeScreen } from '../../../src/phone/screens/HomeScreen';
import { SignInScreen } from '../../../src/phone/screens/SignInScreen';

/** Case: Verify that an employee can sign in on the phone and check in. Clean-up: the run checks out again. */
test('testVerifyThatAnEmployeeCanSignInOnThePhoneAndCheckIn', async ({ phone }) => {
  const login = runLogin(param('signedInAs', 'Mobile user'));
  const home = new HomeScreen(phone);
  await signInOnScreen(phone, login, param('server', testData.env()));
  checkTrue('Sign-in · home shows', await home.isShown());
  const attendance = new AttendanceScreen(phone);
  // set-up: a check-in left by an earlier run is checked out first, so the case starts checked out
  await checkOut(home, attendance, 'Set-up');

  await home.waitUntilReadyToCheckIn();
  await home.openCheckIn();
  try {
    checkEquals('Check in · the app says it was saved', await attendance.submit(), 'success');
    await attendance.backToHomeIfShown();
    await home.waitUntilCheckOutIsAvailable();
    checkTrue('Check in · home shows "Check in" as the last activity', await home.checkInLastActivityIsShown());
  } finally {
    await checkOut(home, attendance, 'Clean-up');
  }
});

/** the case's own sign-in (this case tests it): from whatever screen the app starts on - server, account code, user, password */
async function signInOnScreen(phone: Phone, login: string, server: string): Promise<void> {
  await new SignInScreen(phone).signIn({
    accountCode: credentials.get(login, 'account code|Account code|Account|code'),
    userName: credentials.get(login, 'Username|User name|User|Email'),
    password: credentials.get(login, 'Password'),
  }, server);
  await new HomeScreen(phone).allowLocationIfAsked();
}

/** set-up / clean-up: only when home offers Check-Out - check out and see home back on Check-In */
async function checkOut(home: HomeScreen, attendance: AttendanceScreen, part: string): Promise<void> {
  if (!(await home.offersCheckOut())) return;
  await home.openCheckOut();
  checkEquals(`${part} · check out saved`, await attendance.submit(), 'success');
  await attendance.backToHomeIfShown();
  await home.waitUntilCheckInIsAvailable();
  checkTrue(`${part} · home shows "Check out" as the last activity`, await home.checkOutLastActivityIsShown());
}
