import { AppApi, ok } from '../appApi';

/**
 * Registration requests (the portal's pending employees) by API, as the portal itself calls them: every body is
 * {"Data": ..., "TimeZoneOffset": -180, "Language": 0}. Used by set-up and clean-up only.
 */
export class PendingUsersApi {
  constructor(private readonly admin: AppApi) {}

  /** the id of the registration request with this job number; undefined when the list has none */
  async idOf(jobNumber: string): Promise<string | undefined> {
    const body = { pageNumber: 1, pageSize: 10, TimeZoneOffset: -180, Language: 0,
                   data: { SearchPattern: jobNumber, DepartmentsIDs: [], Type: 15, Status: 3 } };
    const answer = ok(await this.admin.post(this.admin.underRoot('api', 'User/GetAllUserPending'), body), 'User/GetAllUserPending');
    return findId(answer, 'JobNumber', jobNumber, 'ID') ?? findId(answer, 'JobNumber', jobNumber, 'UserId');
  }

  async delete(userId: string): Promise<void> {
    const body = { data: { UserId: userId, RejectionReason: '' }, TimeZoneOffset: -180, Language: 0 };
    ok(await this.admin.post(this.admin.underRoot('api', 'User/DeleteRequest'), body), 'User/DeleteRequest');
  }
}

/** the first object anywhere in the answer whose key equals value; its idKey as text */
export function findId(node: unknown, key: string, value: string, idKey: string): string | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findId(item, key, value, idKey);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node === null || typeof node !== 'object') return undefined;
  const o = node as Record<string, unknown>;
  if (o[key] !== undefined && o[key] !== null && String(o[key]) === value && o[idKey] !== undefined) return String(o[idKey]);
  for (const v of Object.values(o)) {
    const found = findId(v, key, value, idKey);
    if (found !== undefined) return found;
  }
  return undefined;
}
