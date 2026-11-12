import { REGISTRATION_REQUEST } from '../../src/api/records/recordKeys';

/** the record kinds the Employee suites keep for their clean-up (shared by the web tests and the API clean-up) */
export const PENDING_JOBS = REGISTRATION_REQUEST.key;

/** user names of employees a test added, deleted on the screen by "Clean up - Delete the employee record" */
export const ADDED_EMPLOYEE_USERS = 'added_employee_users';
