import { accountCode, employeeToMake, signUpExtras } from '../../../src/api/flows/employeeValues';
import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { nextPassword } from '../../../src/data/newEmployee';
import { runEmployees } from '../../../src/run/runEmployee';
import { testData } from '../../../src/run/testData';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { expectedGreeting } from '../../../src/phone/greeting';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { AccountCodeScreen } from '../../../src/phone/screens/AccountCodeScreen';
import { HomeAccount } from '../../../src/phone/screens/HomeAccount';
import { ProfileScreen } from '../../../src/phone/screens/ProfileScreen';
import { RegisterScreen } from '../../../src/phone/screens/RegisterScreen';
import { passwordOf, server, signInAs } from './employeeOnPhone';

/**
 * The employee's own account on the phone - the TS twins of MobRegistrationTests, MobLoginTests, ResetPassword and
 * OpenAppLoggedInTests. The employee is made by this run (on the app or by API) and deleted by the API clean-up.
 */
test('testVerifyThatANewEmployeeCanRegisterFromTheApp', async ({ phone }) => {
  const e = employeeToMake();
  const x = signUpExtras();
  await new AccountCodeScreen(phone).openSignInForm(accountCode(), server());
  const register = new RegisterScreen(phone);
  await register.openSignUp();
  await register.fill(e, x.password, x.notificationEmail);
  runEmployees.keep({ ...e, state: 'pending' }); // from here on the request may exist - the clean-up deletes it

  checkTrue('Sign-up · "Setup your attendance method" shows', await register.chooseAttendanceMethod());
  checkTrue('Pending home (Take a tour) after registering', await new HomeAccount(phone).takeTourShown());
});

test('testVerifyThatTheApprovedEmployeeCanLogInOnTheApp', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  await signInAs(phone, e); // this case tests the sign-in: the run's one sign-in of the employee on the phone

  const home = new HomeAccount(phone);
  const shown = await home.greeting();
  checkEquals('Home greeting', shown, expectedGreeting(shown, e.firstName));
});

test('testVerifyThatTheEmployeeCanChangeThePasswordAndLogInWithTheNewOne', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = new HomeAccount(phone);
  if (!(await home.isShown(20))) await signInAs(phone, e); // set-up: the run's kept sign-in, else signed in once here
  const old = passwordOf(e);
  await home.openMyProfile();
  const profile = new ProfileScreen(phone);
  const changed = await profile.changePassword(old, nextPassword(old));
  if (changed) runEmployees.markPasswordChanged(e.userName);
  checkTrue('Change password · the app confirmed the new password', changed);

  await profile.logOut();
  await signInAs(phone, e, nextPassword(old));
  const shown = await home.greeting();
  checkEquals('Home greeting after logging in with the new password', shown, expectedGreeting(shown, e.firstName));
});

test('testVerifyThatTheAppOpensSignedInWithTheKeptSignIn', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = new HomeAccount(phone);
  if (!(await home.isShown(20))) await signInAs(phone, e); // set-up: nothing kept yet - one sign-in to keep
  await home.reopenApp(testData.mobile().appPackage);

  checkTrue('App opened again · home shows with no sign-in', await home.isShown(30));
  const shown = await home.greeting();
  checkEquals('Home greeting', shown, expectedGreeting(shown, e.firstName));
});

/**
 * Omar 2026-11-12 (run 985): the trap of the optional pop-up rule - the same flow (Android's location question may or may
 * not appear and is handled), but the case expects a name the app does not have: it must FAIL every time, never pass
 * because the pop-up was handled.
 */
test('testTrapTheAppOpensSignedInWithAWrongGreeting', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const home = new HomeAccount(phone);
  if (!(await home.isShown(20))) await signInAs(phone, e);
  await home.reopenApp(testData.mobile().appPackage);

  checkTrue('App opened again · home shows with no sign-in', await home.isShown(30));
  const shown = await home.greeting();
  checkEquals('Trap · home greets the employee as the case expects', shown, expectedGreeting(shown, `${e.firstName} Trap`));
});
