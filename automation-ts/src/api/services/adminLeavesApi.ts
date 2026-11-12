import { dayPlus } from '../../data/overtimeDays';
import { WebLeave } from '../../data/webLeave';
import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { accountIdOf } from '../flows/adminAccount';
import { listOf, Row } from '../rows';

/** the requests list's status words by StatusId (1 approved, 2 pending, 3 rejected, 4 deleted) */
const STATUS_WORDS: Readonly<Record<number, string>> = { 1: 'مقبول', 2: 'تحت الاجراء', 3: 'مرفوض', 4: 'محذوف' };
const DELETED = STATUS_WORDS[4];

/** the list's words for a StatusId; the number itself when the list has no word for it */
export function statusWord(statusId: unknown): string {
  return STATUS_WORDS[Number(statusId)] ?? String(statusId ?? '');
}

/** the id of the row named name in Arabic or English; a plain error naming what was looked for */
function idByName(rows: Row[], name: string, what: string): number {
  const found = rows.find((r) => r.NameAr === name || r.NameEn === name);
  if (!found) throw new Error(`The account has no leave ${what} called ${name}`);
  return Number(found.ID);
}

/**
 * The admin's leaves by API as the portal calls it (the api-catalog's Leaves calls, read from the portal's script): add a
 * leave for an employee (it arrives approved), a request's status as the list words it, and the list's delete. A
 * request is found by the employee and its note in the list of a wide window of days around today.
 */
export class AdminLeavesApi {
  constructor(private readonly admin: AppApi, private readonly accountId: () => Promise<string> = accountIdOf(admin)) {}

  /** adds the leave for userId; gives back its id (the add does not answer it - found in the list by its note) */
  async add(leave: WebLeave & { userId: string }): Promise<string> {
    const categoryId = idByName(this.rows(await this.post('Leaves/GetAllleaveTypeCategoory', {})), leave.type, 'type');
    const typeId = idByName(this.rows(await this.post('Leaves/GetAllLeavesTypeSubCategory', { data: categoryId })), leave.subType, 'sub type');
    const data = { ID: '', AccountID: await this.accountId(), UserID: leave.userId, ParentTypeID: categoryId, TypeID: typeId,
                   FromDate: leave.from, FromTime: '', ToDate: leave.to, ToTime: '', Notes: leave.notes, AlternateEmployeeID: '' };
    const said = appAnswer(await this.admin.post(this.path('Leaves/AddLeave'), { data }));
    if (!said.ok) throw new Error(`Set-up: the app refused the leave "${leave.notes}": ${said.message}`);
    const id = await this.idByNote(leave.userId, leave.notes);
    if (id === undefined) throw new Error(`Set-up: the leave "${leave.notes}" is not in the requests list after the add`);
    return id;
  }

  /** the employee's request with this note that is not deleted; undefined when there is none */
  async idByNote(userId: string, note: string): Promise<string | undefined> {
    const row = (await this.rowsOf(userId)).find((r) => String(r.Notes ?? '').trim() === note.trim() && statusWord(r.StatusId) !== DELETED);
    return row ? String(row.ID) : undefined;
  }

  /** the employee's requests of any status (a month back to three months ahead) */
  async rowsOf(userId: string): Promise<Row[]> {
    return this.list(userId);
  }

  /** the request's status as the list words it ("مقبول", "محذوف" ...); '' when the list has no such request */
  async statusOf(id: string): Promise<string> {
    const row = (await this.list('', id)).find((r) => String(r.ID) === String(id));
    return row ? statusWord(row.StatusId) : '';
  }

  /** the list's trash icon; the app's own words when it refuses */
  async delete(id: string): Promise<void> {
    const said = appAnswer(await this.admin.post(this.path('Leaves/DeleteLeave'), { data: Number(id) }));
    if (!said.ok) throw new Error(`The app refused to delete leave ${id}: ${said.message}`);
  }

  /** the requests list of any status from a month back to three months ahead, of one employee or one request number */
  private async list(userId: string, leaveNumber = ''): Promise<Row[]> {
    const data = { AccountID: await this.accountId(), LeaveNumber: leaveNumber, DepartmentsIDs: [], employeeGroups: [],
                   EmployeesIDs: userId ? [userId] : [], FromDate: dayPlus(-31), ToDate: dayPlus(93), StatusId: 0, TypeID: 0,
                   AssignToMe: false, FromApproval: false };
    return listOf(await this.post('Leaves/GetAllLeaves', { pageNumber: 1, pageSize: 100, data }));
  }

  private rows(answer: unknown): Row[] {
    const data = (answer as { Data?: unknown } | null)?.Data;
    return Array.isArray(data) ? (data as Row[]) : [];
  }

  private async post(call: string, body: Parameters<AppApi['post']>[1]): Promise<unknown> {
    return ok(await this.admin.post(this.path(call), body), call);
  }

  private path(call: string): string {
    return this.admin.underRoot('api', call);
  }
}
