import { trovaTest as test } from '../../../src/run/trovaTest';
import { employeeToMake, accountCode, employeePassword, signUpExtras } from '../../../src/api/flows/employeeValues';
import { adminServices, approvedEmployeeOfRun, pendingEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { PhoneGuestApi } from '../../../src/api/phoneGuestApi';
import { EmployeeLogInApi, SIGNED_IN } from '../../../src/api/services/employeeLogInApi';
import { EmployeeSignUpApi, UNDER_REVIEW } from '../../../src/api/services/employeeSignUpApi';
import { ACTIVE } from '../../../src/api/services/employeesApi';
import { param } from '../../../src/run/blockParams';
import { runEmployees } from '../../../src/run/runEmployee';
import { checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';

/**
 * Employee cycle by API - the TS twin of tests.api.registration.EmployeeCycleApiTests: the employee signs up the way
 * the app does, the admin finds and approves the request, the employee is active. A case run alone makes the employee
 * it needs by API first; the clean-up deletes every employee the run made.
 */
test('testVerifyThatTheEmployeeCanSignUpFromThePhoneByApi', async () => {
  const { employees, requests } = await adminServices();
  const e = employeeToMake();
  checkFalse(`Before the sign-up · ${e.userName} is not taken`, Boolean((await employees.find(e.userName)) || (await requests.findPending(e.userName))));
  const phone = new EmployeeSignUpApi(new PhoneGuestApi());
  const signedUp = await phone.signUp(await phone.accountId(accountCode()), e, signUpExtras());
  checkTrue('Sign-up · the app took it', signedUp.ok, signedUp.message);
  const id = String(signedUp.data.ID ?? '');
  runEmployees.keep({ ...e, id, state: 'pending' }); // from here on the clean-up deletes it

  checkEquals('Sign-up answer · user name', String(signedUp.data.UserName ?? ''), e.userName);
  checkTrue('Sign-up answer · the user id is not empty', id.length > 0);
  await phone.chooseNoBiometrics();
  const info = await phone.userInfoUnderReview();
  checkEquals(`User info before the approval · "under review" (HTTP ${UNDER_REVIEW})`, info.status, UNDER_REVIEW);
});

test('testVerifyThatTheRequestReachesTheAdminByApi', async () => {
  const e = await pendingEmployeeOfRun();
  const { requests } = await adminServices();
  const row = await requests.findPending(e.userName);

  checkTrue(`${e.userName} is in the registration requests`, row !== undefined);
  checkEquals('Registration request · its id is the sign-up user id', String(row?.ID), String(e.id));
});

test('testVerifyThatTheAdminCanApproveTheRequestByApi', async () => {
  const e = await pendingEmployeeOfRun();
  const { requests } = await adminServices();
  const said = await requests.approve(String(e.id), [await requests.departmentId(param('department', 'test'))], []);
  checkTrue('Approve · the app took it', said.ok, said.message);
  runEmployees.keep({ ...e, state: 'approved' });

  checkTrue(`${e.userName} left the registration requests after the approval`, (await requests.findPending(e.userName)) === undefined);
});

test('testVerifyThatTheEmployeeIsListedInEmployeesByApi', async () => {
  const e = await approvedEmployeeOfRun();
  const { employees } = await adminServices();
  const row = await employees.find(e.userName);

  checkTrue(`${e.userName} is in Employees`, row !== undefined);
  checkEquals('Employees row · status (1 = active)', String(row?.UserStatesID), ACTIVE);
});

/** Java verifyThatTheNewEmployeeCanLoginFromMobileByApi: the approved employee logs in the way the app does (strict) */
test('testVerifyThatTheNewEmployeeCanLogInFromThePhoneByApi', async () => {
  const e = await approvedEmployeeOfRun();
  const guest = new PhoneGuestApi();
  const accountId = await new EmployeeSignUpApi(guest).accountId(accountCode());
  const seconds = Number(param('login_wait_seconds', '30'));
  const phone = new EmployeeLogInApi(guest);
  const login = await phone.logInWhenApproved(accountId, e.userName, employeePassword(false), seconds);

  checkTrue(`Log-in · ${e.userName} logs in within ${seconds} s of the approval`, login.ok, login.message);
  checkEquals('User info after the log-in · HTTP status', (await phone.userInfo()).status, SIGNED_IN);
});
