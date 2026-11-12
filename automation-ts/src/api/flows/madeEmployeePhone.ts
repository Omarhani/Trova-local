import { NewEmployee } from '../../data/newEmployee';
import { Json } from '../../run/runDataFile';
import { runSignIns } from '../../signin/runSignIns';
import { signInKey } from '../../signin/signIns';
import { PhoneGuestApi } from '../phoneGuestApi';
import { EmployeeLogInApi } from '../services/employeeLogInApi';
import { EmployeeSignUpApi } from '../services/employeeSignUpApi';
import { LeaveRequestsApi, PhoneApi } from '../services/leaveRequestsApi';
import { accountCode, employeePassword } from './employeeValues';

/** the made employee's ONE phone sign-in per run: in this block by user name, for later blocks in the run's sign-ins file */
const signedIn = new Map<string, Promise<PhoneApi>>();

const runKey = (e: NewEmployee): string => signInKey(`made employee ${e.userName}`, 'phone');

/** the phone API as the signed-in employee: its calls, its own user id as USER_ID and its account as ACCOUNT_ID */
function asEmployee(phone: PhoneGuestApi, accountId: string): PhoneApi {
  return {
    get: (endpoint) => phone.get(endpoint),
    post: (endpoint, body: Json) => phone.post(endpoint, body),
    value: (key) => {
      const kept: Record<string, string> = { USER_ID: phone.id(), ACCOUNT_ID: accountId };
      if (!kept[key]) throw new Error(`The employee's phone sign-in did not keep ${key}`);
      return kept[key];
    },
  };
}

/**
 * the run's sign-in of the employee an earlier block made (no sign-in call); else User/Login as the employee the run
 * made (the admin's account code, its user name, its password - never printed), kept for the run's later blocks
 */
async function signIn(e: NewEmployee): Promise<PhoneApi> {
  const phone = new PhoneGuestApi();
  const earlier = runSignIns.get(runKey(e));
  if (earlier) {
    phone.useSignIn(earlier.token, earlier.browser.localStorage.USER_ID ?? '');
    console.log(`Signed in as ${e.userName} with this run's sign-in (no sign-in calls)`);
    return asEmployee(phone, earlier.browser.localStorage.ACCOUNT_ID ?? '');
  }
  const accountId = await new EmployeeSignUpApi(phone).accountId(accountCode());
  const login = await new EmployeeLogInApi(phone).logInWhenApproved(accountId, e.userName, employeePassword(false), 30);
  if (!login.ok) throw new Error(`Set-up: ${e.userName} could not sign in on the phone API: ${login.message}`);
  runSignIns.keep(runKey(e), { token: phone.signInToken(), browser: { localStorage: { USER_ID: phone.id(), ACCOUNT_ID: accountId }, sessionStorage: {}, cookies: {} } });
  console.log(`Signed in as ${e.userName} on the phone API - the run's one sign-in of this employee`);
  return asEmployee(phone, accountId);
}

/**
 * The leave requests of an employee the run made, through its own phone API (set-up of the admin's decisions: the
 * employee sends its own requests) - signed in once per run; a refused sign-in is not tried again in the run.
 */
export async function madeEmployeeLeaves(e: NewEmployee): Promise<LeaveRequestsApi> {
  const key = e.userName.trim().toLowerCase();
  let phone = signedIn.get(key);
  if (!phone) {
    phone = signIn(e);
    signedIn.set(key, phone);
  }
  return new LeaveRequestsApi(await phone);
}
