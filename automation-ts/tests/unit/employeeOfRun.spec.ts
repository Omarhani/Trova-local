import { expect, test } from '@playwright/test';
import { employeeBlockedBySetUp } from '../../src/api/flows/runEmployeeMaker';

/** run 688: the set-up block FAILED and the cases made the employee again and PASSED - never both */
test('a failed set-up blocks the cases that need its employee, with expected / seen', () => {
  const e = employeeBlockedBySetUp('The call /api/Account/GetAccountIdByCode did not answer (ETIMEDOUT: connect)');
  expect(e.name).toBe('MissingData');
  expect(e.message).toMatch(/expected: the employee made by the set-up, seen: .*ETIMEDOUT/);
});
