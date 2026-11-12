import { madeEmployeeLeaves } from '../../../src/api/flows/madeEmployeePhone';
import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { LeaveRequestsApi, LeaveRow } from '../../../src/api/services/leaveRequestsApi';
import { accountClock } from '../../../src/data/appClock';
import { freeLeaveDay, weekendOf } from '../../../src/data/leaveDay';
import { leaveKindOf } from '../../../src/data/leaveTypes';
import { NewEmployee } from '../../../src/data/newEmployee';
import { param } from '../../../src/run/blockParams';
import { testData } from '../../../src/run/testData';
import { Phone } from '../../../src/phone/phoneSession';
import { HomeAccount } from '../../../src/phone/screens/HomeAccount';
import { LeaveToSend } from '../../../src/phone/screens/LeaveRequestScreen';
import { signInAs } from '../employeeAccount/employeeOnPhone';

/** the employee the suite runs as on the phone and on its API: the one this run made by API (Java mob/mobLeaveRequest) */
export async function leaveEmployee(): Promise<NewEmployee> {
  return approvedEmployeeOfRun();
}

/** the employee's leave requests through the run's ONE phone API sign-in of the employee */
export async function employeeLeaves(e: NewEmployee): Promise<LeaveRequestsApi> {
  return madeEmployeeLeaves(e);
}

/** set-up by API: the leave type from the app's own list and a free working day after today; the employee's requests now */
export async function leavePlan(leaves: LeaveRequestsApi): Promise<{ toSend: LeaveToSend; rows: LeaveRow[] }> {
  const rows = await leaves.list();
  const today = accountClock.wallNow(); // the app's day, never the computer's (run 1025)
  const day = freeLeaveDay(rows, today, weekendOf(param('leave_weekend', 'Fri,Sat')));
  const kind = leaveKindOf(await leaves.kinds(), param('leave_type', 'Sick leave'));
  return { toSend: { kind, day, today, note: param('leave_note', 'Trova leave {run}') }, rows };
}

/** the request in the employee's own list by its note, looked for up to seconds (the list may lag Send by a moment) */
export async function sentRow(leaves: LeaveRequestsApi, note: string, seconds = 10): Promise<LeaveRow | undefined> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const row = LeaveRequestsApi.byNote(await leaves.list(), note);
    if (row || Date.now() >= until) return row;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** the app opens again with its kept sign-in; else the run's ONE sign-in of the employee on its screens */
export async function openAppAs(phone: Phone, e: NewEmployee): Promise<void> {
  await new HomeAccount(phone).reopenApp(testData.mobile().appPackage);
  await signInAs(phone, e);
}

/** the app was signed in as another employee: its data cleared and the run's one sign-in made as the employee */
export async function signInAgainAsTheEmployee(phone: Phone, e: NewEmployee): Promise<void> {
  const app = testData.mobile().appPackage;
  console.log(`The app was signed in as another employee - signing in once as ${e.userName}`);
  await phone.execute('mobile: clearApp', { appId: app });
  // clearing takes back the permissions the session granted (run 645: the location question) - give them again
  await phone.execute('mobile: changePermissions', { permissions: 'all', appPackage: app, action: 'grant' }).catch(() => undefined);
  await phone.execute('mobile: activateApp', { appId: app });
  await signInAs(phone, e);
}
