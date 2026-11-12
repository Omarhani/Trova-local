import { NewEmployee } from '../data/newEmployee';
import { RunRecords, runRecords } from './runRecords';

/** the user names the clean-up deletes (api/records/recordKeys EMPLOYEE) */
const MADE = 'made_employees';
const SET_UP_FAILED = 'employeeSetUpFailed';
const DETAILS = 'made_employee_details';
const CHANGED = 'changed_password_of';

/**
 * The employees this run made (blocks run in their own processes, so they live in the run's records file): the
 * current one for the next block, every user name for the clean-up. Never a password - a changed one is only marked.
 */
export class RunEmployees {
  constructor(private readonly records: RunRecords) {}

  /** keeps (or updates) the employee; its user name is cleaned up once at the end */
  keep(e: NewEmployee): void {
    for (const old of this.details().filter((d) => d.userName === e.userName)) this.records.forget(DETAILS, JSON.stringify(old));
    this.records.keep(DETAILS, JSON.stringify(e));
    if (!this.records.newestFirst(MADE).includes(e.userName)) this.records.keep(MADE, e.userName);
  }

  /** the newest employee this run made and has not deleted yet (the clean-up drops the user name only) */
  current(): NewEmployee | undefined {
    const made = this.madeUserNames();
    return this.details().find((d) => made.includes(d.userName));
  }

  /** the user names the clean-up deletes, newest first */
  madeUserNames(): string[] {
    return this.records.newestFirst(MADE);
  }

  /** the employee is gone: neither current nor cleaned up again */
  forget(userName: string): void {
    this.records.forget(MADE, userName);
    for (const old of this.details().filter((d) => d.userName === userName)) this.records.forget(DETAILS, JSON.stringify(old));
  }

  /** run 688: the set-up block could not make the run's employee - its reason, kept for the cases that need it */
  markSetUpFailed(why: string): void {
    this.records.keep(SET_UP_FAILED, why.slice(0, 300));
  }

  setUpFailed(): string | undefined {
    return this.records.newestFirst(SET_UP_FAILED)[0];
  }

  markPasswordChanged(userName: string): void {
    this.records.keep(CHANGED, userName);
  }

  passwordChanged(userName: string): boolean {
    return this.records.newestFirst(CHANGED).includes(userName);
  }

  private details(): NewEmployee[] {
    return this.records.newestFirst(DETAILS).map((d) => JSON.parse(d) as NewEmployee);
  }
}

export const runEmployees = new RunEmployees(runRecords);
