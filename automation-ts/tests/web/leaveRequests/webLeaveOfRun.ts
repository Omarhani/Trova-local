import { adminLogin } from '../../../src/api/flows/employeeValues';
import { AppApi } from '../../../src/api/appApi';
import { AdminLeavesApi } from '../../../src/api/services/adminLeavesApi';
import { fullName, NewEmployee } from '../../../src/data/newEmployee';
import { dayPlus } from '../../../src/data/overtimeDays';
import { param } from '../../../src/run/blockParams';
import { RecordApi } from '../../../src/run/cleanUpMade';
import { runRecords } from '../../../src/run/runRecords';
import type { WebLeave } from '../../../src/web/pages/LeavesPage';
import { userIdOf } from '../../api/attendance/movementsOfRun';

/** run records kind: the ids of the leaves the admin added for the run's employee (the clean-up deletes those left) */
export const MADE_WEB_LEAVES = 'web_leave_ids';

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
    notes: param('leave_note', 'Trova web leave {run}'),
  };
}

export async function adminLeaves(): Promise<AdminLeavesApi> {
  return new AdminLeavesApi(await AppApi.signedInAs(adminLogin(), 'web'));
}

/** the leave this run added for the employee and did not delete; else one added now by API (the delete case run alone) */
export async function webLeaveOfRun(e: NewEmployee): Promise<string> {
  const made = runRecords.newestFirst(MADE_WEB_LEAVES)[0];
  if (made) return made;
  const id = await (await adminLeaves()).add({ ...webLeaveFor(e), userId: await userIdOf(e) });
  runRecords.keep(MADE_WEB_LEAVES, id);
  return id;
}

/** the clean-up's view: a leave is still there while its status is not "deleted"; deleted the way the list's trash does */
export function webLeaveRecords(api: AdminLeavesApi): RecordApi {
  return {
    idOf: async (id) => ((await api.statusOf(id)) === LEAVE_DELETED ? undefined : id),
    delete: async (id) => api.delete(id),
  };
}
