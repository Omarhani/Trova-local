import { NewEmployee } from '../../data/newEmployee';
import { MissingData } from '../../report/failureKind';
import { madeChecked } from '../../records/checkedSetUp';
import { EMPLOYEE } from '../records/recordKeys';
import { runEmployees } from '../../run/runEmployee';
import { AppApi } from '../appApi';
import { PhoneGuestApi } from '../phoneGuestApi';
import { EmployeeSignUpApi } from '../services/employeeSignUpApi';
import { ACTIVE, EmployeesApi } from '../services/employeesApi';
import { RegistrationRequestsApi } from '../services/registrationRequestsApi';
import { accountCode, adminLogin, employeeToMake, signUpExtras } from './employeeValues';

/** the admin's API services, on the run's ONE API sign-in of the admin */
export async function adminServices(): Promise<{ employees: EmployeesApi; requests: RegistrationRequestsApi }> {
  const admin = await AppApi.signedInAs(adminLogin(), 'web');
  return { employees: new EmployeesApi(admin), requests: new RegistrationRequestsApi(admin) };
}

/**
 * Set-up by API (Java EmployeeApi.create): a new employee signs up the way the app does and picks "no biometrics", so
 * its request waits for the admin. A taken user name stops here (the app can break an existing employee). Kept for
 * the clean-up as soon as the app took it.
 */
export async function makePendingEmployee(): Promise<NewEmployee> {
  const { employees, requests } = await adminServices();
  const e = employeeToMake();
  if ((await employees.find(e.userName)) || (await requests.findPending(e.userName))) {
    throw new Error(`${e.userName} already exists - a set-up never reuses an employee it did not make`);
  }
  const phone = new EmployeeSignUpApi(new PhoneGuestApi());
  const signedUp = await phone.signUp(await phone.accountId(accountCode()), e, signUpExtras());
  if (signedUp.ok) runEmployees.keep({ ...e, state: 'pending' }); // from here the request exists - the clean-up deletes it
  const id = madeChecked(EMPLOYEE, { ...signedUp, id: String(signedUp.data.ID ?? '') }, e.userName); // "Made employee id 512"
  const made: NewEmployee = { ...e, id, state: 'pending' };
  runEmployees.keep(made);
  await phone.chooseNoBiometrics();
  return made;
}

/** the admin approves the request into every department and employee group, then sees it active (set-up by API) */
export async function approveByApi(e: NewEmployee): Promise<NewEmployee> {
  const { employees, requests } = await adminServices();
  const request = await requests.findPending(e.userName);
  if (!request) throw new Error(`Set-up: ${e.userName} is not in the registration requests`);
  const said = await requests.approve(String(request.ID), await requests.allDepartmentIds(), await requests.allEmployeeGroupIds());
  if (!said.ok) throw new Error(`Set-up: the app refused to approve ${e.userName}: ${said.message}`);
  const row = await employees.find(e.userName);
  if (String(row?.UserStatesID) !== ACTIVE) throw new Error(`Set-up: ${e.userName} is not active in Employees after the approval`);
  const approved: NewEmployee = { ...e, id: String(row?.ID ?? e.id), state: 'approved' };
  runEmployees.keep(approved);
  return approved;
}

/** run 688: a set-up that could not make the employee blocks the cases that need it - never made again quietly */
export function employeeBlockedBySetUp(why: string): MissingData {
  return new MissingData(`Not tested - expected: the employee made by the set-up, seen: it could not be made (${why})`);
}

function stopIfSetUpFailed(): void {
  const why = runEmployees.setUpFailed();
  if (why) throw employeeBlockedBySetUp(why);
}

/** the run's employee waiting for the admin; else one made now by API (the case's runnable set-up) */
export async function pendingEmployeeOfRun(): Promise<NewEmployee> {
  stopIfSetUpFailed();
  const e = runEmployees.current();
  return e?.state === 'pending' ? e : makePendingEmployee();
}

/** the run's approved employee; else the pending one approved, else one made and approved now by API */
export async function approvedEmployeeOfRun(): Promise<NewEmployee> {
  stopIfSetUpFailed();
  const e = runEmployees.current();
  if (e?.state === 'approved') return e;
  return approveByApi(e?.state === 'pending' ? e : await makePendingEmployee());
}

