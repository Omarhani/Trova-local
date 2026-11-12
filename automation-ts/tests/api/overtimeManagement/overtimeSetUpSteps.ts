import { test } from '@playwright/test';
import { AppApi } from '../../../src/api/appApi';
import { overtimeRequestKind } from '../../../src/api/records/overtimeRequestKind';
import { REJECTED as REJECTED_STATUS } from '../../../src/api/services/overtimeApi';
import { OvertimeSetUp, SetUpResult } from '../../../src/api/services/overtimeSetUp';
import { statusAndWords } from '../../../src/records/lines';
import { once, RecordKind, resultOf } from '../../../src/records/recordKind';
import { caseRecords } from '../../../src/run/caseRecords';
import { param } from '../../../src/run/blockParams';
import { checkLine } from '../../../src/report/checks';

/** the block's employees (the second when the first already has today's request) and manager */
export function setUp(): OvertimeSetUp {
  const employees = [param('employee_login', 'Employee over Time'), param('employee_login_2', 'Employee over Time 2')];
  return new OvertimeSetUp(employees, param('manager_login', 'Account manager over Time'));
}

/** today's request with the block's hours and reason - a checked step: "Made overtime request id <id>", else FAILED */
export async function todaysRequest(hours = Number(param('overtime_hours', '1'))): Promise<SetUpResult> {
  return setUp().makePending(hours, param('overtime_reason', 'Trova overtime check'));
}

/** the manager rejects the request the set-up made (by Trova's known call, or the plain body) - a checked step */
export async function rejectMade(result: SetUpResult, plainBody = false): Promise<void> {
  const id = result.made!.id;
  const manager = await setUp().manager();
  const body = { RequestId: [id], Status: REJECTED_STATUS, Reason: param('reject_reason', 'Not needed') };
  const answer = resultOf(plainBody ? await manager.post('OvertimeRequests/ApproveRejectOvertimeRequest', body)
    : await manager.call('POST /OvertimeRequests/ApproveRejectOvertimeRequest', body));
  checkLine(answer.ok ? `Rejected overtime request id ${id}`
    : `Expected: overtime request id ${id} is rejected / Actual: ${statusAndWords(answer.status, answer.message)}`, answer.ok);
}

/** the set-up hands its request to the cases; none made = "Not tested - needs <record>" with the app's own words */
export function hand(forTest: string | undefined, record: string, result: SetUpResult): void {
  if (result.said.length > 0) console.log(`Set-up · the app said: ${result.said.join('; ')}`);
  test.skip(result.made === undefined, `Not tested - needs ${record} - the app said: ${result.said.join('; ')}`);
  if (forTest === undefined) caseRecords.madeForAll(record, result.made!.text);
  else caseRecords.made(forTest, record, result.made!.text);
}

/** the clean-up's view of this run's overtime requests: withdrawn by the employee who sent each, read back by the manager */
export function overtimeRequests(): RecordKind {
  return overtimeRequestKind(once(() => setUp().manager()), (login) => AppApi.signedInAs(login, 'phone'));
}
