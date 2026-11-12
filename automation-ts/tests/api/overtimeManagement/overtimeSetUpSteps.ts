import { test } from '@playwright/test';
import { OvertimeSetUp, SetUpResult } from '../../../src/api/services/overtimeSetUp';
import { caseRecords } from '../../../src/run/caseRecords';
import { param } from '../../../src/run/blockParams';

/** the block's employees (the second when the first already has today's request) and manager */
export function setUp(): OvertimeSetUp {
  const employees = [param('employee_login', 'Employee over Time'), param('employee_login_2', 'Employee over Time 2')];
  return new OvertimeSetUp(employees, param('manager_login', 'Account manager over Time'));
}

/** today's request with the block's hours and reason */
export async function todaysRequest(hours = Number(param('overtime_hours', '1'))): Promise<SetUpResult> {
  return setUp().makePending(hours, param('overtime_reason', 'Trova overtime check'));
}

/** the set-up hands its request to the cases; none made = "Not tested - needs <record>" with the app's own words */
export function hand(forTest: string | undefined, record: string, result: SetUpResult): void {
  if (result.said.length > 0) console.log(`Set-up · the app said: ${result.said.join('; ')}`);
  test.skip(result.made === undefined, `Not tested - needs ${record} - the app said: ${result.said.join('; ')}`);
  if (forTest === undefined) caseRecords.madeForAll(record, result.made!.text);
  else caseRecords.made(forTest, record, result.made!.text);
}
