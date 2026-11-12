import { Made, RecordKind } from '../../records/recordKind';
import { WorkPlanCleanUpApi } from '../services/workPlanCleanUpApi';
import { WORK_PLAN } from './recordKeys';

/** the work plans this run made: found by name, deleted by id with every shift in it, read back by id */
export function workPlanKind(api: () => Promise<WorkPlanCleanUpApi>): RecordKind {
  return {
    ...WORK_PLAN,
    idOf: async (name: string): Promise<Made | undefined> => {
      const row = await (await api()).plan(name);
      return row === undefined ? undefined : { entry: name, id: String(row.ID) };
    },
    delete: async (m: Made) => (await api()).deleteById(m.id),
    isThere: async (m: Made) => (await (await api()).planWithId(m.id)) !== undefined,
  };
}
