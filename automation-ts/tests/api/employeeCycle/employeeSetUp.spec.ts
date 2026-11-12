import { trovaTest as test } from '../../../src/run/trovaTest';
import { adminLogin } from '../../../src/api/flows/employeeValues';
import { employeeRecords } from '../../../src/api/flows/employeeRecords';
import { adminServices, approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { AppApi } from '../../../src/api/appApi';
import { ACTIVE } from '../../../src/api/services/employeesApi';
import { cleanUpMade } from '../../../src/run/cleanUpMade';
import { runEmployees } from '../../../src/run/runEmployee';
import { checkEquals } from '../../../src/report/checks';

/** Set-up and clean-up by the app's API for the suites that make an employee (Java EmployeeApiTests). */
test('logInProgrammatically', async () => {
  const admin = await AppApi.signedInAs(adminLogin(), 'web');
  checkEquals("Sign-in · the run's one sign-in of the admin, by API", admin === undefined ? 'no sign-in' : 'signed in', 'signed in');
});

/** the run's employee, approved and active - made now by API when the run has none (createEmployeeByApi) */
test('approvedEmployeeProgrammatically', async () => {
  const e = await approvedEmployeeOfRun().catch((err: unknown) => {
    runEmployees.markSetUpFailed(err instanceof Error ? err.message : String(err)); // run 688: its cases are BLOCKED, not made again
    throw err;
  });
  const row = await (await adminServices()).employees.find(e.userName);
  checkEquals(`Set-up · ${e.userName} is active in Employees`, String(row?.UserStatesID), ACTIVE);
});

/** deletes every employee this run made - an employee or a still waiting request - and checks by API each is gone */
test('cleanUpEmployeesProgrammatically', async () => {
  const made = runEmployees.madeUserNames();
  test.skip(made.length === 0, 'Nothing was made by this run - nothing to delete');
  const { employees, requests } = await adminServices();
  const left = await cleanUpMade(made, employeeRecords(employees, requests), (userName) => runEmployees.forget(userName));
  checkEquals('Clean-up · employees this run made still there', left.join(', ') || 'none', 'none');
});
