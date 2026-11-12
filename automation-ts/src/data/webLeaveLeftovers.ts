import type { Row } from '../api/rows';
import type { RecordApi } from '../run/cleanUpMade';
import type { WebLeave } from './webLeave';

/** StatusId of a deleted request - it stays in the list but blocks nothing */
const DELETED = 4;

/** the admin's leave calls a set-up and the clean-up need (AdminLeavesApi) */
export interface LeaveStore {
  rowsOf(userId: string): Promise<Row[]>;
  idByNote(userId: string, note: string): Promise<string | undefined>;
  delete(id: string): Promise<unknown>;
  add(leave: WebLeave & { userId: string }): Promise<string>;
}

/** what the run keeps for a leave it makes: the employee and the note (known before Save, unlike the id) */
export function webLeaveKey(userId: string, note: string): string {
  return `${userId}|${note}`;
}

function keyParts(key: string): { userId: string; note: string } {
  const at = key.indexOf('|');
  return { userId: key.slice(0, at), note: key.slice(at + 1) };
}

const day = (v: unknown): string => String(v ?? '').slice(0, 10);

/** the ids of the run's own kind of leave (its note starts with kind), not deleted, on days that meet from..to */
export function blockingLeftovers(rows: Row[], kind: string, from: string, to: string): string[] {
  return rows
    .filter((r) => String(r.Notes ?? '').trim().startsWith(kind) && Number(r.StatusId) !== DELETED)
    .filter((r) => !day(r.FromDate) || !day(r.ToDate) || (day(r.FromDate) <= to && day(r.ToDate) >= from))
    .map((r) => String(r.ID));
}

/** set-up: deletes by API the run's own leftover leaves of the employee that would block this one; gives back their ids */
export async function clearLeftovers(api: Pick<LeaveStore, 'rowsOf' | 'delete'>, userId: string, leave: WebLeave, kind: string,
                                     say: (line: string) => void = console.log): Promise<string[]> {
  const ids = blockingLeftovers(await api.rowsOf(userId), kind, leave.from, leave.to);
  for (const id of ids) {
    await api.delete(id);
    say(`Set-up - deleted a leftover leave of an earlier case on the same days (${id})`);
  }
  return ids;
}

/** the clean-up's view of a kept key: the leave is there while one not deleted has its note; deleted as the list's trash */
export function webLeaveRecords(api: Pick<LeaveStore, 'idByNote' | 'delete'>): RecordApi {
  return {
    idOf: async (key) => {
      const { userId, note } = keyParts(key);
      return api.idByNote(userId, note);
    },
    delete: async (id) => api.delete(id),
  };
}

/**
 * The delete case's leave: the run's newest kept leave that is still there; else its own on its own days - the run's
 * leftovers there deleted first, the key kept before the add (from then on the leave may exist, the clean-up looks).
 */
export async function leaveToDelete(api: LeaveStore, userId: string, made: string[], own: WebLeave, kind: string,
                                    keep: (key: string) => void): Promise<{ id: string; key: string }> {
  const records = webLeaveRecords(api);
  for (const key of made) {
    const id = await records.idOf(key);
    if (id !== undefined) return { id: String(id), key };
  }
  await clearLeftovers(api, userId, own, kind);
  const key = webLeaveKey(userId, own.notes);
  keep(key);
  return { id: await api.add({ ...own, userId }), key };
}
