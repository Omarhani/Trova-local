import { Made, RecordKind, settled } from '../../records/recordKind';
import { LeaveRequestsApi } from '../services/leaveRequestsApi';
import { LEAVE_REQUEST } from './recordKeys';

/** the employee's own leave calls the clean-up uses (LeaveRequestsApi) */
export type EmployeeLeaves = Pick<LeaveRequestsApi, 'list' | 'delete'>;

/** "<user name>|<note>" -> its parts */
function partsOf(entry: string): { userName: string; note: string } {
  const at = entry.indexOf('|');
  return { userName: entry.slice(0, at), note: entry.slice(at + 1) };
}

/**
 * The leave requests this run sent from the phone: found in the employee's own list by their note (kept before Send),
 * deleted by id as that employee, read back by id in the same list. leavesOf gives undefined for an employee the run
 * no longer has - that request FAILS the clean-up, it is never passed quietly.
 */
export function leaveRequestKind(leavesOf: (userName: string) => Promise<EmployeeLeaves | undefined>): RecordKind {
  const leaves = async (userName: string): Promise<EmployeeLeaves> => {
    const api = await leavesOf(userName);
    if (!api) throw new Error(`the run no longer has the employee ${userName} - its request cannot be reached`);
    return api;
  };
  return {
    ...LEAVE_REQUEST,
    idOf: async (entry: string): Promise<Made | undefined> => {
      const { userName, note } = partsOf(entry);
      const row = LeaveRequestsApi.byNote(await (await leaves(userName)).list(), note);
      return row === undefined ? undefined : { entry, id: String(row.ID) };
    },
    delete: async (m: Made) => {
      const api = await leaves(partsOf(m.entry).userName);
      return settled(() => api.delete(m.id));
    },
    isThere: async (m: Made) => (await (await leaves(partsOf(m.entry).userName)).list()).some((r) => String(r.ID) === m.id),
  };
}
