import { Made, RecordKind, settled } from '../../records/recordKind';
import { AppApi } from '../appApi';
import { OvertimeApi, OvertimeRow, PENDING } from '../services/overtimeApi';
import { OVERTIME_REQUEST } from './recordKeys';

/** "<login>|<id>" -> its parts */
function partsOf(entry: string): { login: string; id: string } {
  const at = entry.lastIndexOf('|');
  return { login: entry.slice(0, at), id: entry.slice(at + 1) };
}

/** the employee who sent a request, signed in on the phone (only the sender can withdraw it) */
export type PhoneSignIn = (login: string) => Promise<AppApi>;

/**
 * The overtime requests this run made: withdrawn by id as the employee who sent it, read back in the manager's list.
 * The app has no delete for a request a test approved or rejected - that one is kept and said so, never called gone.
 */
export function overtimeRequestKind(manager: () => Promise<AppApi>, employee: PhoneSignIn): RecordKind {
  const row = async (id: string): Promise<OvertimeRow | undefined> =>
    (await OvertimeApi.list(await manager())).find((r) => String(r.Id) === id);
  return {
    ...OVERTIME_REQUEST,
    idOf: async (entry: string): Promise<Made> => ({ entry, id: partsOf(entry).id }),
    keptBecause: async (m: Made) => {
      const found = await row(m.id);
      return found !== undefined && found.Status !== PENDING
        ? `the app does not delete a decided request (status ${found.Status})` : undefined;
    },
    delete: async (m: Made) => settled(async () => OvertimeApi.delete(await employee(partsOf(m.entry).login), Number(m.id))),
    isThere: async (m: Made) => (await row(m.id)) !== undefined,
  };
}
