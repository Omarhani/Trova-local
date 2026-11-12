import { Made, RecordKind, settled } from '../../records/recordKind';
import { AdminLeavesApi, DELETED_LEAVE } from '../services/adminLeavesApi';
import { WEB_LEAVE } from './recordKeys';

/** "<userId>|<note>" -> its parts */
function partsOf(entry: string): { userId: string; note: string } {
  const at = entry.indexOf('|');
  return { userId: entry.slice(0, at), note: entry.slice(at + 1) };
}

/**
 * The leaves the admin added for the run's employee: found by employee + note, deleted by id with the list's trash, read
 * back by id - a deleted leave stays in the list as "deleted", so gone = deleted or not in the list.
 */
export function webLeaveKind(api: () => Promise<AdminLeavesApi>): RecordKind {
  return {
    ...WEB_LEAVE,
    idOf: async (entry: string): Promise<Made | undefined> => {
      const { userId, note } = partsOf(entry);
      const id = await (await api()).idByNote(userId, note);
      return id === undefined ? undefined : { entry, id };
    },
    delete: async (m: Made) => {
      const leaves = await api();
      return settled(() => leaves.delete(m.id));
    },
    isThere: async (m: Made) => {
      const status = await (await api()).statusOf(m.id);
      return status !== '' && status !== DELETED_LEAVE;
    },
  };
}
