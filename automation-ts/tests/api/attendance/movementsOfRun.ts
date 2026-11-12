import { adminLogin } from '../../../src/api/flows/employeeValues';
import { adminServices } from '../../../src/api/flows/runEmployeeMaker';
import { AppApi } from '../../../src/api/appApi';
import { Movement, MovementKind, SideNames, TransactionsApi } from '../../../src/api/services/transactionsApi';
import { daysAround, todaysMovements, zoneOfRows } from '../../../src/api/services/movementDays';
import { Row } from '../../../src/api/rows';
import { accountClock, attendanceClock } from '../../../src/data/appClock';
import { NewEmployee } from '../../../src/data/newEmployee';

/**
 * The run's employee's check ins and check outs as the admin's API lists them (Java TransactionsApi.getDayMovements) -
 * the proof by API of the attendance cases and their set-up. Only the run's own employee is ever read or written.
 */

/** today as yyyy-MM-dd on the app's attendance clock (the gate's, as the server files movements), never the computer's */
export function today(): string {
  return attendanceClock.today();
}

/** the employee's user id from Employees (one registered on the app has none kept by the run) */
export async function userIdOf(e: NewEmployee): Promise<string> {
  const row = await (await adminServices()).employees.find(e.userName);
  if (row?.ID === undefined) throw new Error(`Set-up: ${e.userName} is not in Employees`);
  return String(row.ID);
}

/** the admin's attendance calls, on the run's ONE API sign-in of the admin */
export async function transactions(): Promise<TransactionsApi> {
  return new TransactionsApi(await AppApi.signedInAs(adminLogin(), 'web'));
}

/** the employee's movements of a day; no day = today's on the app's own clock (run 1026: near midnight the days differ) */
export async function movementsOn(e: NewEmployee, day?: string): Promise<Movement[]> {
  if (day) return (await transactions()).dayMovements(await userIdOf(e), day);
  const now = Date.now();
  const rows = await rowsAround(e, now);
  return todaysMovements(rows, now, attendanceClock.offsetMin());
}

/** the server's rows of the days around the account's day; the attendance clock learns the gate's from them */
export async function rowsAround(e: NewEmployee, now = Date.now()): Promise<Row[]> {
  const api = await transactions();
  const userId = await userIdOf(e);
  const rows: Row[] = [];
  for (const d of daysAround(now, accountClock.offsetMin())) rows.push(...await api.dayRows(userId, d)); // one call at a time (set-up rule)
  attendanceClock.learn(zoneOfRows(rows));
  return rows;
}

/** the times ("HH:mm") of one kind of movement */
export function timesOf(movements: Movement[], kind: MovementKind): string[] {
  return movements.filter((m) => m.kind === kind).map((m) => m.time);
}

/** how many movements of the kind the employee has today, looked for until it is the expected one (the list may lag a save) */
export async function countBecomes(e: NewEmployee, kind: MovementKind, expected: number, seconds = 15): Promise<number> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const seen = timesOf(await movementsOn(e), kind).length;
    if (seen === expected || Date.now() >= until) return seen;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** the times of the kind today, looked for until they are the expected ones (the list may lag a save) */
export async function timesBecome(e: NewEmployee, kind: MovementKind, expected: string[], seconds = 15): Promise<string[]> {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const seen = timesOf(await movementsOn(e), kind);
    if (JSON.stringify(seen) === JSON.stringify(expected) || Date.now() >= until) return seen;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** the side (department) the web drawer takes for the employee: the first of theirs with a gate, found once by API (case 529) */
export async function sideOfRun(e: NewEmployee): Promise<SideNames | undefined> {
  return (await transactions()).sideWithGates(await userIdOf(e));
}
