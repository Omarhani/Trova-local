import { trovaTest as test } from '../../../src/run/trovaTest';
import { adminLogin } from '../../../src/api/flows/employeeValues';
import { adminServices, approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { AppApi } from '../../../src/api/appApi';
import { EmployeeLocationsApi } from '../../../src/api/services/employeeLocationsApi';
import { valueForEnv } from '../../../src/data/envValue';
import { param } from '../../../src/run/blockParams';
import { testData } from '../../../src/run/testData';
import { checkContains, checkTrue } from '../../../src/report/checks';

/**
 * Locations of the run's employee by API - the TS twin of tests.api.locations.EmployeeLocationsApiTests (Edit employee >
 * Locations > Assign locations). The location and the location group are the account's own, named per environment in
 * the suite ("Test=Home; Stage=hany"). What is assigned goes with the employee the clean-up deletes.
 */
test('testVerifyThatTheAdminCanAssignLocationsToTheEmployeeByApi', async () => {
  const e = await approvedEmployeeOfRun();
  const location = valueForEnv(param('location', ''), testData.env());
  const group = valueForEnv(param('location_group', ''), testData.env());
  const row = await (await adminServices()).employees.find(e.userName);
  checkTrue(`${e.userName} is in Employees`, row !== undefined);
  const userId = String(row?.ID ?? '');

  const locations = new EmployeeLocationsApi(await AppApi.signedInAs(adminLogin(), 'web'));
  const said = await locations.assign(userId, [await locations.assignableLocationId(userId, location)],
    [await locations.assignableGroupId(userId, group)]);
  checkTrue('Assign locations · the app took it', said.ok, said.message);

  const assigned = (await locations.assignedNames(userId)).join(' | ');
  checkContains(`The employee's locations · include the location ${location}`, assigned, location);
  checkContains(`The employee's locations · include the location group ${group}`, assigned, group);
});
