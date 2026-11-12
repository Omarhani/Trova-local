import { randomUUID } from 'node:crypto';
import { LeaveSpan, ymd } from '../../data/leaveDay';
import { LeaveToSend } from '../../data/leaveToSend';
import { LeaveCategory } from '../../data/leaveTypes';
import { Json } from '../../run/runDataFile';
import { RecordApi } from '../../run/cleanUpMade';
import { appAnswer } from '../appAnswer';
import { HttpAnswer, json } from '../http';
import { phoneEnvelope } from '../phoneEnvelope';

/** what this needs of the employee's phone API (AppApi signed in on the phone side gives it) */
export interface PhoneApi {
  get(endpoint: string): Promise<HttpAnswer>;
  post(endpoint: string, body: Json): Promise<HttpAnswer>;
  value(key: string): string;
}

/** one of the employee's requests in the app's own list */
export interface LeaveRow extends LeaveSpan {
  ID: number;
  StatusId: number;
  TypeID?: number;
  Notes?: string | null;
  /** when the server saved it, on its own clock (run 1025: "2026-11-13T00:05:26.88" at 23:05 here) */
  CreatedDate?: string | null;
}

/** StatusId of a request still waiting for the manager */
export const LEAVE_PENDING = 2;

/** StatusId of a request the manager approved / rejected (the app's counters: 1 approved, 3 rejected) */
export const LEAVE_APPROVED = 1;
export const LEAVE_REJECTED = 3;

/** the app's add-leave call (the phone's new-leave form, Send - LeaveClient.createLeave in the app's package, 2026-11-11) */
export const ADD_LEAVE_CALL = 'Leaves/Create';

/**
 * The employee's leave requests by the phone app's own calls (seen in the app's log on Test, 2026-11-11): the list
 * (Leaves/AllLeaves), the leave types (Leaves/LeaveTypes) and the delete of a still pending one (Leaves/Delete) - the
 * set-up and clean-up of the phone leave case, as the employee, with no admin sign-in.
 */
export class LeaveRequestsApi {
  constructor(private readonly employee: PhoneApi) {}

  async list(): Promise<LeaveRow[]> {
    const data = await this.said('Leaves/AllLeaves', await this.employee.post('Leaves/AllLeaves', this.envelope(this.userId())));
    return Array.isArray(data) ? (data as LeaveRow[]) : [];
  }

  async kinds(): Promise<LeaveCategory[]> {
    const data = await this.said('Leaves/LeaveTypes', await this.employee.get('Leaves/LeaveTypes'));
    return Array.isArray(data) ? (data as LeaveCategory[]) : [];
  }

  /**
   * the new-leave form's Send for a whole day, with the body the app builds (its CreateLeaveRequest: userID, AccountID,
   * fromDate / toDate yyyy-MM-dd, no times, typeID, notes); the app's own words when it refuses
   */
  async send(leave: LeaveToSend): Promise<{ ok: boolean; message: string }> {
    const day = ymd(leave.day);
    const data = { userID: this.userId(), AccountID: this.accountId(), fromDate: day, toDate: day, fromTime: '', toTime: '',
                   typeID: leave.kind.typeId, notes: leave.note, files: null, AlternateEmployeeIDs: null };
    return appAnswer(await this.employee.post(ADD_LEAVE_CALL, this.envelope(data)));
  }

  /** the request id goes as text, the way the app sends it */
  async delete(id: number | string): Promise<void> {
    await this.said('Leaves/Delete', await this.employee.post('Leaves/Delete', this.envelope({ userID: this.userId(), LeaveID: String(id) })));
  }

  static byNote(rows: LeaveRow[], note: string): LeaveRow | undefined {
    return note.trim() === '' ? undefined : rows.find((r) => (r.Notes ?? '').trim() === note.trim());
  }

  private userId(): string {
    return this.employee.value('USER_ID');
  }

  private accountId(): string {
    return this.employee.value('ACCOUNT_ID');
  }

  private envelope(data: Json): Json {
    return phoneEnvelope(this.userId(), data, randomUUID()) as Json;
  }

  /** the answer's Data when the app took the call (a bare list as it is: GET Leaves/LeaveTypes, run 634); else its own words */
  private async said(endpoint: string, answer: HttpAnswer): Promise<unknown> {
    const took = appAnswer(answer);
    if (!took.ok) throw new Error(`${endpoint}: the app said "${took.message || `HTTP ${answer.status}`}"`);
    const body = json(answer) as unknown;
    return Array.isArray(body) ? body : (body as { Data?: unknown } | null)?.Data;
  }
}

/** the clean-up's view of the requests: this run's request by its note, deleted by its id */
export function leaveRecords(api: LeaveRequestsApi): RecordApi {
  return {
    idOf: async (note) => LeaveRequestsApi.byNote(await api.list(), note)?.ID,
    delete: async (id) => api.delete(id),
  };
}
