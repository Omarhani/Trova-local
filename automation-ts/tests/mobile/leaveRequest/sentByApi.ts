import { LeaveRequestsApi, LeaveRow } from '../../../src/api/services/leaveRequestsApi';
import { accountClock, offsetOfStamp } from '../../../src/data/appClock';
import { leaveNoteKey } from '../../../src/data/leaveNotesOfRun';
import { NewEmployee } from '../../../src/data/newEmployee';
import { LEAVE_REQUEST } from '../../../src/api/records/recordKeys';
import { madeChecked } from '../../../src/records/checkedSetUp';
import { madeRecords } from '../../../src/records/madeRecords';
import type { LeaveToSend } from '../../../src/phone/screens/LeaveRequestScreen';
import { leavePlan, sentRow } from './leaveOnPhone';

/**
 * Set-up by API: the employee sends its own leave request the way the app does (Leaves add call), on the next free
 * working day with the block's note (new every run) - kept for the clean-up before it is sent. Gives back its row and
 * the moment it was sent; the app's clock is taken from the server's own stamp of it (run 1025).
 */
export async function sentByApi(leaves: LeaveRequestsApi, e: NewEmployee): Promise<{ row: LeaveRow; toSend: LeaveToSend; sentAt: number }> {
  const { toSend } = await leavePlan(leaves);
  const key = leaveNoteKey(e.userName, toSend.note);
  madeRecords.keep(LEAVE_REQUEST, key); // from here the request may exist - the clean-up looks for it
  const sentAt = Date.now();
  const said = await leaves.send(toSend);
  const row = said.ok ? await sentRow(leaves, toSend.note) : undefined;
  // a checked step: the app takes it AND the employee's list gives its id - "Made leave request id <id>"
  madeChecked(LEAVE_REQUEST, { ...said, ok: row !== undefined, id: row ? String(row.ID) : '',
    message: said.ok ? `the request "${toSend.note}" is not in the employee's own list` : said.message }, key);
  const made = row as LeaveRow; // madeChecked has failed the step when there is no row
  accountClock.learn(offsetOfStamp(made.CreatedDate, sentAt));
  return { row: made, toSend, sentAt };
}

/** the request is no longer in the employee's own list, looked for up to seconds (the list may lag the delete) */
export async function goneFromList(leaves: LeaveRequestsApi, note: string, seconds = 10): Promise<boolean> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    if (!LeaveRequestsApi.byNote(await leaves.list(), note)) return true;
    if (Date.now() >= until) return false;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
