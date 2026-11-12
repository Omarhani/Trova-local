import { randomBytes } from 'node:crypto';
import { dayPlus } from '../../data/overtimeDays';
import { firstTaker } from '../../data/overtimeTaker';
import { runRecords } from '../../run/runRecords';
import { AppApi } from '../appApi';
import { OvertimeApi } from './overtimeApi';

/** run records kind: "<login>|<id>" of the overtime requests this run made (the clean-up withdraws the pending ones as that login) */
export const MADE_IDS = 'overtimeRequests';

/** a request the set-up made: its reason text (the manager's list row), its id and the employee who sent it */
export interface MadeRequest {
  text: string;
  id: number;
  login: string;
}

/** what the set-up got: the request, or why not in the app's own words */
export interface SetUpResult {
  made?: MadeRequest;
  said: string[];
}

/**
 * The Overtime suites' set-up by API, on the proven business rule (Omar 2026-11-10): the app takes a request for
 * TODAY only (earlier days are refused, the manager page shows no later day) and one per employee per day - so the
 * first employee, else the second when the first already has today's request; the manager's list must show it.
 */
export class OvertimeSetUp {
  constructor(private readonly employees: string[], private readonly managerLogin: string) {}

  async makePending(hours: number, reason: string): Promise<SetUpResult> {
    const text = `${reason} ${randomBytes(3).toString('hex')}`;
    const taker = await firstTaker(this.employees, async (login) =>
      OvertimeApi.create(await AppApi.signedInAs(login, 'phone'), dayPlus(0), hours, text));
    if (taker.login === undefined) return { said: taker.said };
    const row = OvertimeApi.byReason(await OvertimeApi.list(await this.manager()), text);
    if (row === undefined) return { said: [...taker.said, `${taker.login}: the app took it but the manager's list does not show it`] };
    runRecords.keep(MADE_IDS, `${taker.login}|${row.Id}`);
    return { made: { text, id: row.Id, login: taker.login }, said: taker.said };
  }

  async manager(): Promise<AppApi> {
    return AppApi.signedInAs(this.managerLogin, 'web');
  }
}
