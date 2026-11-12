import { NewEmployee, newEmployee, nextPassword, userNameFor } from '../../data/newEmployee';
import { param } from '../../run/blockParams';
import { credentials, runLogin } from '../../run/credentials';
import { RUN_STAMP } from '../../run/runStamp';
import { SignUpExtras } from '../services/employeeSignUpApi';

const USER = 'Username|User name|User|Email';
const CODE = 'account code|Account code|Account|code';

/** the login the block runs as (the admin: set-up, clean-up and the web cases) */
export function adminLogin(): string {
  return runLogin(param('signedInAs', 'Admin'));
}

/** the account code of the admin's account - the new employee signs up on it */
export function accountCode(): string {
  return credentials.get(adminLogin(), CODE);
}

/**
 * The employee this block would make: block parameters employee_tag, employee_first_name, employee_user_name (default:
 * the admin's e-mail with +<tag><run stamp>) - a new one every run (Java TestEmployee.generate).
 */
export function employeeToMake(): NewEmployee {
  const tag = param('employee_tag', 'api');
  const userName = param('employee_user_name', '') || userNameFor(credentials.get(adminLogin(), USER), tag, RUN_STAMP);
  return newEmployee({ tag, stamp: RUN_STAMP, userName, firstName: param('employee_first_name', 'Omar') });
}

/**
 * The new employee's password is the one of a saved Trova login (employee_password_from, default "Mobile user" - a
 * password the app already takes); after a change in this run, the next one. Never printed, never written down.
 */
export function employeePassword(changed: boolean): string {
  const password = credentials.get(param('employee_password_from', 'Mobile user'), 'Password');
  return changed ? nextPassword(password) : password;
}

/** what the sign-up form takes besides the employee */
export function signUpExtras(): SignUpExtras {
  return {
    password: employeePassword(false),
    notificationEmail: param('employee_notification_email', '') || credentials.get(adminLogin(), USER),
    languageId: param('employee_language', 'en').toLowerCase() === 'ar' ? 1 : 2,
  };
}
