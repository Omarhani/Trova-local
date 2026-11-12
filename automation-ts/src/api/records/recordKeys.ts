import type { RecordKey } from '../../records/madeRecords';

/**
 * The app's record kinds by their run records key (the keys the makers already used) and plain name - what a set-up
 * maker registers under and a clean-up block drains (records/madeRecords). Kept by id unless said otherwise.
 */
/** kept by the plan's unique name ("Omar WebPlan {run}") - a plan made on the screens has no id before it is saved */
export const WORK_PLAN: RecordKey = { key: 'workPlanNames', noun: 'work plan' };
/** kept by the employee's unique user name: an employee or a still waiting registration request */
export const EMPLOYEE: RecordKey = { key: 'made_employees', noun: 'employee' };
/** kept as "<login>|<id>": withdrawn by the employee who sent it */
export const OVERTIME_REQUEST: RecordKey = { key: 'overtimeRequests', noun: 'overtime request' };
export const INVOICE: RecordKey = { key: 'invoiceIds', noun: 'invoice' };
/** kept as "<userId>|<note>" before Save (the add answers no id) */
export const WEB_LEAVE: RecordKey = { key: 'web_leave_keys', noun: 'leave' };
/** kept by the request's job number (made on the screens) */
export const REGISTRATION_REQUEST: RecordKey = { key: 'pendingJobNumbers', noun: 'registration request' };
