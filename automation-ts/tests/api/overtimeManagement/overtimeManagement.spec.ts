import { randomBytes } from 'node:crypto';
import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { OvertimeApi, PENDING } from '../../../src/api/services/overtimeApi';
import { dayPlus } from '../../../src/data/overtimeDays';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';

const MADE = 'overtimeRequests'; // "<login>|<id>": the clean-up withdraws each as the employee who made it

/** today on the app's own clock, yyyy-MM-dd (the app takes today only: the manager's page shows today, earlier days are refused) */
function today(): string {
  return dayPlus(0);
}

/** the employees that may send it, in order: one request per employee per day, so the second when the first has one today */
function employees(): string[] {
  return [param('employee_login', 'Employee over Time'), param('employee_login_2', 'Employee over Time 2')].filter(Boolean);
}

/** Set-up: an employee sends an overtime request for today the way the phone app does; the manager's list shows it. */
test('setUpAnEmployeeWithAPendingOvertimeRequestForToday', async () => {
  const manager = await AppApi.signedInAs(param('manager_login', 'Account manager over Time'), 'web');
  const reason = `${param('overtime_reason', 'Trova overtime check')} ${randomBytes(3).toString('hex')}`;
  const said: string[] = [];
  let madeBy = '';
  for (const login of employees()) {
    let employee: AppApi;
    try {
      employee = await AppApi.signedInAs(login, 'phone');
    } catch (e) { // Test 8094 run 578: a login whose phone sign-in is refused - say which one, try the next
      said.push(`${login}: could not sign in on the phone (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const sent = await OvertimeApi.create(employee, today(), Number(param('overtime_hours', '1')), reason);
    if (sent.ok) { madeBy = login; break; }
    said.push(`${login}: ${sent.message || 'refused without a reason'}`);
  }
  checkTrue('Set-up · the app took the overtime request for today', madeBy !== '', `the app said: ${said.join('; ')}`);
  const made = OvertimeApi.byReason(await OvertimeApi.list(manager), reason);
  checkTrue('Set-up · the manager list shows the new request', made !== undefined);
  if (made) runRecords.keep(MADE, `${madeBy}|${made.Id}`);
});

/** Clean-up: each pending request this run made is withdrawn by its own employee and must be gone from the list. */
test('cleanUpProgrammatically', async () => {
  const kept = runRecords.newestFirst(MADE);
  test.skip(kept.length === 0, 'Nothing was kept by this run - nothing to delete');
  const manager = await AppApi.signedInAs(param('manager_login', 'Account manager over Time'), 'web');
  for (const record of kept) {
    const [login, id] = record.split('|');
    const row = (await OvertimeApi.list(manager)).find((r) => String(r.Id) === id);
    if (row && row.Status === PENDING) { // a request a test approved or rejected stays: only a pending one can be withdrawn
      await OvertimeApi.delete(await AppApi.signedInAs(login, 'phone'), Number(id));
      const gone = !(await OvertimeApi.list(manager)).some((r) => String(r.Id) === id);
      checkTrue(`Clean-up · request ${id} is gone`, gone);
    }
    runRecords.forget(MADE, record);
  }
});
