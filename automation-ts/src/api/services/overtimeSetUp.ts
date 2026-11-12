import { randomBytes } from 'node:crypto';
import { dayPlus } from '../../data/overtimeDays';
import { firstTaker } from '../../data/overtimeTaker';
import { madeChecked } from '../../records/checkedSetUp';
import { OVERTIME_REQUEST } from '../records/recordKeys';
import { AppApi } from '../appApi';
import { OvertimeApi } from './overtimeApi';

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

  /**
   * a checked step (Omar 2026-11-13): the app must take the request and the manager's list must give its id ("Made
   * overtime request id 88"), else it FAILS with the app's words; kept as "<login>|<id>" for the clean-up
   */
  async makePending(hours: number, reason: string): Promise<SetUpResult> {
    const text = `${reason} ${randomBytes(3).toString('hex')}`;
    let status = 0;
    const taker = await firstTaker(this.employees, async (login) => {
      const sent = await OvertimeApi.create(await AppApi.signedInAs(login, 'phone'), dayPlus(0), hours, text);
      status = sent.status;
      return sent;
    });
    if (taker.login === undefined) madeChecked(OVERTIME_REQUEST, { ok: false, status, message: taker.said.join('; ') });
    const row = OvertimeApi.byReason(await OvertimeApi.list(await this.manager()), text);
    const id = row === undefined ? '' : String(row.Id);
    madeChecked(OVERTIME_REQUEST, { ok: row !== undefined, status: 200, id,
      message: `${taker.login}: the app took it but the manager's list does not show it` }, id && `${taker.login}|${id}`);
    return { made: { text, id: Number(id), login: taker.login as string }, said: taker.said };
  }

  async manager(): Promise<AppApi> {
    return AppApi.signedInAs(this.managerLogin, 'web');
  }
}
