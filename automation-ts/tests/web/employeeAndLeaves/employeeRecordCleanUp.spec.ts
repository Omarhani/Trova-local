import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';
import { RegistrationRequestsPage } from '../../../src/web/pages/RegistrationRequestsPage';
import { webTest as test } from '../../../src/web/webTest';
import { ADDED_EMPLOYEE_USERS } from '../employeeAndLeavesRecords';

/** Clean-up on the screen (EmployeeRecordCleanUpTests): deletes the employee requests a test kept under a key, newest first. */
test('deleteEmployeeRecord', async ({ page }) => {
  const recordKey = param('recordKey', ADDED_EMPLOYEE_USERS);
  const requests = new RegistrationRequestsPage(page);
  await requests.openRegistrationRequests();
  const userNames = runRecords.newestFirst(recordKey);
  if (userNames.length === 0) {
    console.log(`Clean-up: nothing kept under ${recordKey} - nothing to delete`);
    return;
  }
  console.log('Clean-up on the screen - learn the delete call to make it faster');
  for (const userName of userNames) {
    checkTrue('Clean-up · employee request deleted', await requests.deleteEmployeeRequest(userName));
    runRecords.forget(recordKey, userName);
  }
});
