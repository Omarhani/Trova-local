import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { Json } from '../../run/runDataFile';
import { listOf, Row } from '../rows';
import { accountIdOf } from '../flows/adminAccount';

/** a movement of the attendance: a check in (type 1) or a check out (type 2) */
export type MovementKind = 'check in' | 'check out';

/** one movement as the server holds it: its kind and its time "HH:mm" on the account's clock */
export interface Movement {
  kind: MovementKind;
  time: string;
}

const TYPE: Readonly<Record<MovementKind, number>> = { 'check in': 1, 'check out': 2 };

/** "2026-11-11T09:00:00" (or "2026-11-11 09:00") -> "09:00"; '' when the text has no time */
export function clockOf(createDate: unknown): string {
  return /[T ](\d{2}:\d{2})/.exec(String(createDate ?? ''))?.[1] ?? '';
}

/** the rows of a list answer: Data.List, else a bare Data list (the call answers either way - Java getDayMovements) */
function rowsOf(answer: unknown): Row[] {
  const list = listOf(answer);
  if (list.length) return list;
  const data = (answer as { Data?: unknown } | null)?.Data;
  return Array.isArray(data) ? (data as Row[]) : [];
}

/** a side (department) as the drawer's list may show it: each name it has (Arabic, English ...) */
export interface SideNames {
  names: string[];
}

/** the department's names: every filled text field whose key holds "Name" (NameAr, NameEn, Name ...) */
function namesOf(side: Row): string[] {
  return Object.entries(side).filter(([k, v]) => /name/i.test(k) && typeof v === 'string' && v.trim()).map(([, v]) => String(v).trim());
}

/** the server's rows as movements, oldest first (rows of another type are not a check in or out and are left out) */
export function movementsOf(rows: Row[]): Movement[] {
  return [...rows]
    .sort((a, b) => String(a.CreateDate ?? '').localeCompare(String(b.CreateDate ?? '')))
    .flatMap((r) => {
      const kind = (Object.keys(TYPE) as MovementKind[]).find((k) => TYPE[k] === Number(r.TransactionTypeID));
      return kind ? [{ kind, time: clockOf(r.CreateDate) }] : [];
    });
}

/**
 * An employee's attendance movements by the admin's API as the portal calls it - the TS twin of api.services.TransactionsApi:
 * every movement of a day (Transaction/GetAllTransactionsByUserId), and "add movement" (Transaction/CreateAuditTransaction)
 * on the first gate the drawer offers; a check out goes on the day's check in's session.
 */
export class TransactionsApi {
  constructor(private readonly admin: AppApi, private readonly accountId: () => Promise<string> = accountIdOf(admin)) {}

  /** every movement the server holds for the employee on day (yyyy-MM-dd), oldest first */
  async dayMovements(userId: string, day: string): Promise<Movement[]> {
    return movementsOf(await this.dayRows(userId, day));
  }

  /** the server's own rows of the day (each with its CreateDate and its clock, LocalTimeZone) */
  async dayRows(userId: string, day: string): Promise<Row[]> {
    const body = { pageNumber: 1, pageSize: 100, data: { Date: day, UserID: userId, EmployeeType: '' } };
    return rowsOf(await this.post('Transaction/GetAllTransactionsByUserId', body));
  }

  /** the admin adds a movement of kind at time ("HH:mm") on day; a check out needs the day's check in first */
  async add(userId: string, kind: MovementKind, day: string, time: string): Promise<void> {
    const gate = await this.firstGate(userId);
    const sessionId = kind === 'check in' ? '' : await this.checkInSession(userId, day);
    const Data = { transactionType: TYPE[kind], createDate: `${day} ${time}`, accessGateId: gate.ID as Json, userId,
                   accountId: await this.accountId(), sessionId: sessionId as Json, timezoneID: gate.TimeZoneID as Json };
    const call = 'Transaction/CreateAuditTransaction';
    const said = appAnswer(await this.admin.post(this.admin.underRoot('api', call), { Data }));
    if (!said.ok) throw new Error(`The app refused to add the ${kind} at ${time} on ${day}: ${said.message}`);
  }

  /** the side (department) the add drawer should take: the employee's first one that has an active gate, by its names; none = undefined */
  async sideWithGates(userId: string): Promise<SideNames | undefined> {
    const found = await this.firstWithGate(userId);
    return found ? { names: namesOf(found.side) } : undefined;
  }

  /** the first gate the add drawer offers: the employee's departments in order, the first that has an active gate */
  private async firstGate(userId: string): Promise<Row> {
    const found = await this.firstWithGate(userId);
    if (found) return found.gate;
    throw new Error(`None of the employee's departments has an active gate - the admin cannot add a movement for user ${userId}`);
  }

  /** the employee's departments in order (the drawer's side list), each one's gate list until one has a gate */
  private async firstWithGate(userId: string): Promise<{ side: Row; gate: Row } | undefined> {
    const departments = rowsOf(await this.post('Department/GetDepartmentsByUserId', { data: userId }));
    for (const side of departments) {
      const gates = rowsOf(await this.post('Location/GetAllActiveLocationByUserDepartmentID', { data: { UserID: userId, DepartmentID: side.ID as Json } }));
      if (gates.length) return { side, gate: gates[0] };
    }
    return undefined;
  }

  /** the session of the day's last check in, as the movements page lists it (the check out is paired with it) */
  private async checkInSession(userId: string, day: string): Promise<unknown> {
    const body = { Data: { FromDate: day, ToDate: day, DepartmentsIDs: [], UserIds: [userId] }, pageNumber: 1, pageSize: 10 };
    const row = listOf(await this.post('Reports/GetUsersTransactionCorrections', body)).find((r) => String(r.UserId) === userId);
    const moves = Array.isArray(row?.Transactions) ? (row.Transactions as Row[]) : [];
    const checkIn = moves.filter((m) => Number(m.TransactionTypeId) === TYPE['check in']).pop();
    if (!checkIn) throw new Error(`Set-up: user ${userId} has no check in on ${day} - a check out needs one`);
    return checkIn.SessionId;
  }

  private async post(call: string, body: Parameters<AppApi['post']>[1]): Promise<unknown> {
    return ok(await this.admin.post(this.admin.underRoot('api', call), body), call);
  }
}
