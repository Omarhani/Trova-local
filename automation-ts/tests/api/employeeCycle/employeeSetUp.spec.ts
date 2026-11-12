import { trovaTest as test } from '../../../src/run/trovaTest';
import { adminLogin } from '../../../src/api/flows/employeeValues';
import { adminServices, approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { AppApi } from '../../../src/api/appApi';
import { employeeKind } from '../../../src/api/records/employeeKind';
import { ACTIVE } from '../../../src/api/services/employeesApi';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';
import { signInLine } from '../../../src/records/signInLine';
import { runEmployees } from '../../../src/run/runEmployee';
import { checkEquals, checkTrue } from '../../../src/report/checks';

/** Set-up and clean-up by the app's API for the suites that make an employee (Java EmployeeApiTests). */
test('logInProgrammatically', async () => {
  const admin = await AppApi.signedInAs(adminLogin(), 'web');
  checkTrue(signInLine(adminLogin(), 'api'), admin !== undefined);
});

/** the run's employee, approved and active - made now by API when the run has none ("Made employee id ..." is its line) */
test('approvedEmployeeProgrammatically', async () => {
  const e = await approvedEmployeeOfRun().catch((err: unknown) => {
    runEmployees.markSetUpFailed(err instanceof Error ? err.message : String(err)); // run 688: its cases are BLOCKED, not made again
    throw err;
  });
  const row = await (await adminServices()).employees.find(e.userName);
  checkEquals(`Set-up · ${e.userName} is active in Employees`, String(row?.UserStatesID), ACTIVE);
});

/** deletes by id every employee this run made - an employee or a still waiting request - each read back gone */
test('cleanUpEmployeesProgrammatically', async () => {
  await cleanUpRun([employeeKind(once(adminServices))]);
});
