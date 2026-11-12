import { accountClock } from '../../data/appClock';
import { CallResult, resultOf } from '../../records/recordKind';
import { AppApi, ok } from '../appApi';

/** one row of the manager's overtime list, the fields the set-up and clean-up use */
export interface OvertimeRow {
  Id: number;
  Status: number;
  Reason: string;
}

export const PENDING = 0;
export const REJECTED = 2;

/**
 * Overtime requests by API: the employee sends / withdraws them the way the phone app does (Trova's known body), the
 * manager's list shows them - the TS twin of api.services.OvertimeApi.
 */
export class OvertimeApi {
  /** the employee sends a request for day (yyyy-MM-dd); ok + the app's own words when it refused (one request per day ...) */
  static async create(employee: AppApi, day: string, hours: number, reason: string): Promise<CallResult> {
    return resultOf(await employee.call('POST /overtimeRequests/Create',
      { RequestDate: `${day}T00:00:00`, RequestedMinutes: hours * 60, Reason: reason }));
  }

  /** the employee withdraws a still pending request */
  static async delete(employee: AppApi, id: number): Promise<void> {
    ok(await employee.post('overtimeRequests/Delete', { Id: id }), 'overtimeRequests/Delete');
  }

  /** the manager's list of this year's requests, newest first */
  static async list(manager: AppApi): Promise<OvertimeRow[]> {
    const year = accountClock.wallNow().getFullYear();
    const body = { pageNumber: 1, pageSize: 100, TimeZoneOffset: -180, Language: 0,
                   data: { SearchTerm: '', DepartmentsIDs: [], DateFrom: `${year}-01-01`, DateTo: `${year}-12-31`,
                           AssignToMe: false, EmployeeGroups: [] } };
    const answer = ok(await manager.post('OvertimeRequests/GetAllOvertimeRequests', body), 'OvertimeRequests/GetAllOvertimeRequests');
    const rows = (answer as { Data?: { List?: OvertimeRow[] } }).Data?.List;
    return Array.isArray(rows) ? rows : [];
  }

  static byReason(rows: OvertimeRow[], reason: string): OvertimeRow | undefined {
    return rows.find((r) => r.Reason === reason);
  }
}
