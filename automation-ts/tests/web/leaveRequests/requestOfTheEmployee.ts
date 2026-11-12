import { madeEmployeeLeaves } from '../../../src/api/flows/madeEmployeePhone';
import { LeaveRequestsApi, LeaveRow } from '../../../src/api/services/leaveRequestsApi';
import { freeLeaveDay, weekendOf } from '../../../src/data/leaveDay';
import { leaveKindOf } from '../../../src/data/leaveTypes';
import { NewEmployee } from '../../../src/data/newEmployee';
import { param } from '../../../src/run/blockParams';

/**
 * Set-up by API for the admin's decisions (Java mobFullCycleForLeaves sends them from the app): the run's own employee
 * sends its own request by its phone API - the leave type from the app's list, the next free working day, the block's
 * note (new every run, one per case). The request goes with the employee the clean-up deletes.
 */
export async function requestOfTheEmployee(e: NewEmployee): Promise<{ leaves: LeaveRequestsApi; row: LeaveRow }> {
  const leaves = await madeEmployeeLeaves(e);
  const today = new Date();
  const day = freeLeaveDay(await leaves.list(), today, weekendOf(param('leave_weekend', 'Fri,Sat')));
  const kind = leaveKindOf(await leaves.kinds(), param('leave_type', 'Sick leave'));
  const note = param('leave_note', 'Trova leave decision {run}');
  const said = await leaves.send({ kind, day, today, note });
  if (!said.ok) throw new Error(`Set-up: the app refused the leave request of ${e.userName}: ${said.message}`);
  const row = await rowOf(leaves, note);
  if (!row) throw new Error(`Set-up: the request "${note}" is not in ${e.userName}'s own list`);
  return { leaves, row };
}

/** the request in the employee's own list by its note, looked for up to seconds (the list may lag a change) */
export async function rowOf(leaves: LeaveRequestsApi, note: string, seconds = 10): Promise<LeaveRow | undefined> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const row = LeaveRequestsApi.byNote(await leaves.list(), note);
    if (row || Date.now() >= until) return row;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** the request's status in the employee's own list once it is the expected one, at most seconds (undefined = not listed) */
export async function statusBecomes(leaves: LeaveRequestsApi, id: number, expected: number, seconds = 15): Promise<number | undefined> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const status = (await leaves.list()).find((r) => r.ID === id)?.StatusId;
    if (status === expected || Date.now() >= until) return status;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
