import { adminLogin } from '../../../src/api/flows/employeeValues';
import { AppApi } from '../../../src/api/appApi';
import { WEB_LEAVE } from '../../../src/api/records/recordKeys';
import { AdminLeavesApi } from '../../../src/api/services/adminLeavesApi';
import { fullName, NewEmployee } from '../../../src/data/newEmployee';
import { dayPlus } from '../../../src/data/overtimeDays';
import { clearLeftovers, leaveToDelete, webLeaveKey } from '../../../src/data/webLeaveLeftovers';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import type { WebLeave } from '../../../src/web/pages/LeavesPage';
import { userIdOf } from '../../api/attendance/movementsOfRun';

export { webLeaveRecords } from '../../../src/data/webLeaveLeftovers';

/** run records kind: employee + note of each leave the admin added for the run's employee (the clean-up deletes those left) */
export const MADE_WEB_LEAVES = WEB_LEAVE.key;

/** every leave this suite makes has a note that starts so - a leftover of this kind on the same days is the run's own */
export const WEB_LEAVE_KIND = 'Trova web leave';

/** "deleted" on the requests list and in its details - a deleted request stays in the list with this status */
export const LEAVE_DELETED = 'محذوف';

/**
 * The leave of the Java LeaveRequestTests (annual leave, "اجازة" / "سنوية", the run's note) for the run's employee - on
 * days ahead of today (block parameters, default tomorrow to the day after), so it never meets the day's check in.
 */
export function webLeaveFor(e: NewEmployee): WebLeave {
  return {
    jobNumber: e.jobNumber,
    fullName: fullName(e),
    type: param('leave_type', 'اجازة'),
    subType: param('leave_sub_type', 'سنوية'),
    from: dayPlus(Number(param('leave_from_days_ahead', '1'))),
    to: dayPlus(Number(param('leave_to_days_ahead', '2'))),
    notes: param('leave_note', `${WEB_LEAVE_KIND} {run}`),
  };
}

/** run 994: the delete case's own leave (when the run has none) sits on its own days and note - never the add case's */
export function ownDeleteLeave(e: NewEmployee): WebLeave {
  return {
    ...webLeaveFor(e),
    from: dayPlus(Number(param('delete_leave_from_days_ahead', '4'))),
    to: dayPlus(Number(param('delete_leave_to_days_ahead', '5'))),
    notes: param('delete_leave_note', `${WEB_LEAVE_KIND} (delete) {run}`),
  };
}

export async function adminLeaves(): Promise<AdminLeavesApi> {
  return new AdminLeavesApi(await AppApi.signedInAs(adminLogin(), 'web'));
}

/** the add case's set-up: the run's own leftover on its days deleted by API; gives back the key to keep before Save */
export async function readyToAdd(e: NewEmployee, leave: WebLeave): Promise<string> {
  const userId = await userIdOf(e);
  await clearLeftovers(await adminLeaves(), userId, leave, WEB_LEAVE_KIND);
  return webLeaveKey(userId, leave.notes);
}

/** the leave this run added for the employee and did not delete; else its own one added now by API (the case run alone) */
export async function webLeaveOfRun(e: NewEmployee): Promise<{ id: string; key: string }> {
  return leaveToDelete(await adminLeaves(), await userIdOf(e), runRecords.newestFirst(MADE_WEB_LEAVES), ownDeleteLeave(e),
    WEB_LEAVE_KIND, (key) => runRecords.keep(MADE_WEB_LEAVES, key));
}
