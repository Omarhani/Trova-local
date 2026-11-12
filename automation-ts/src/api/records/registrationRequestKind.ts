import { Made, RecordKind, settled } from '../../records/recordKind';
import { PendingUsersApi } from '../services/pendingUsersApi';
import { REGISTRATION_REQUEST } from './recordKeys';

/** the registration requests this run made on the screens: found by job number, deleted by id, read back by job number */
export function registrationRequestKind(api: () => Promise<PendingUsersApi>): RecordKind {
  return {
    ...REGISTRATION_REQUEST,
    idOf: async (jobNumber: string): Promise<Made | undefined> => {
      const id = await (await api()).idOf(jobNumber);
      return id === undefined ? undefined : { entry: jobNumber, id };
    },
    delete: async (m: Made) => {
      const requests = await api();
      return settled(() => requests.delete(m.id));
    },
    isThere: async (m: Made) => (await (await api()).idOf(m.entry)) === m.id,
  };
}
