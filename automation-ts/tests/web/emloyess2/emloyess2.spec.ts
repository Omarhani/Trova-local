import { param } from '../../../src/run/blockParams';
import { caseRecords } from '../../../src/run/caseRecords';
import { runRecords } from '../../../src/run/runRecords';
import { checkContains, checkEquals, checkTrue } from '../../../src/report/checks';
import { RegistrationRequestsPage as Page } from '../../../src/web/pages/RegistrationRequestsPage';
import { webTest as test } from '../../../src/web/webTest';
import { PENDING_JOBS } from '../employeeAndLeavesRecords';

/** Emloyess 2 - the TS twin of tests.web.emloyess2.Emloyess2Tests: 340 adds, 341 edits, 342 deletes the same employee. */
const USER_RECORD = "the new employee's user name";
const LAST_NAME_RECORD = "the new employee's last name";
const JOB_RECORD = "the new employee's job number";

test('testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests', async ({ page }) => {
  const first = param('employee_first_name', 'Omar');
  const last = param('employee_last_name', 'Testone');
  const userName = param('employee_user_name', 'omar.tc01+{run}@t2saas.sa');
  const jobNumber = param('employee_job_number', 'TC3110A{run}');
  const jobTitle = param('employee_job_title', 'QA');
  const requests = new Page(page);

  await requests.openRegistrationRequests();
  const countBefore = await requests.listCount();
  await requests.clickAddEmployee();
  await requests.insertField(Page.FIRST_NAME, first);
  await requests.insertField(Page.LAST_NAME, last);
  await requests.insertField(Page.USER_NAME, userName);
  await requests.insertField(Page.JOB_NUMBER, jobNumber);
  await requests.pickAnyExistingDepartment();
  await requests.insertField(Page.JOB_TITLE, jobTitle);
  await requests.clickSave();
  runRecords.keep(PENDING_JOBS, jobNumber); // the clean-up deletes only what this run made
  caseRecords.madeForAll(USER_RECORD, userName);
  caseRecords.madeForAll(LAST_NAME_RECORD, last);
  caseRecords.madeForAll(JOB_RECORD, jobNumber);

  checkContains('Add employee · toast', await requests.toastText(), 'تمت اضافة الموظف بنجاح');
  checkTrue('Add employee · drawer closes', await requests.waitForDrawerToClose());
  checkEquals('Add employee · list count goes up by 1', await requests.listCountBecomes(countBefore + 1), countBefore + 1);
  await requests.searchEmployee(userName);
  checkEquals('Add employee · rows with the new user name', await requests.rowsOfUser(userName, 1), 1);
  const row = await requests.rowTextOfUser(userName);
  checkContains('Add employee · row name', row, `${first} ${last}`);
  checkContains('Add employee · row user name', row, userName);
  checkContains('Add employee · row job number', row, jobNumber);
  checkContains('Add employee · row status', row, 'غير مستكمل');
});

test('testVerifyThatTheAdminCanEditTheNewEmployeesData', async ({ page }) => {
  const first = param('employee_first_name', 'Omarr');
  const jobTitle = param('employee_job_title', 'Senior QA');
  const requests = new Page(page);

  await requests.openRegistrationRequests();
  const userName = caseRecords.mine(USER_RECORD);
  const last = caseRecords.mine(LAST_NAME_RECORD);
  const jobNumber = caseRecords.mine(JOB_RECORD);
  await requests.searchEmployee(userName);
  checkEquals("Edit employee · the employee's row shows", await requests.rowsOfUser(userName, 1), 1);
  await requests.clickEditEmployee(userName);
  await requests.insertField(Page.FIRST_NAME, first);
  await requests.insertField(Page.JOB_TITLE, jobTitle);
  await requests.clickSave();

  checkContains('Edit employee · toast', await requests.toastText(), 'تم تعديل بيانات الموظف بنجاح');
  checkTrue('Edit employee · drawer closes', await requests.waitForDrawerToClose());
  await requests.searchEmployee(userName);
  checkEquals('Edit employee · rows with the user name', await requests.rowsOfUser(userName, 1), 1);
  checkContains('Edit employee · row name', await requests.rowTextOfUser(userName), `${first} ${last}`);
  await requests.clickEditEmployee(userName);
  checkEquals('Edit employee · job title', await requests.fieldValueBecomes(Page.JOB_TITLE, jobTitle), jobTitle);
  checkEquals('Edit employee · user name unchanged', await requests.fieldValueBecomes(Page.USER_NAME, userName), userName);
  checkEquals('Edit employee · job number unchanged', await requests.fieldValueBecomes(Page.JOB_NUMBER, jobNumber), jobNumber);
  await requests.closeDrawer();
});

test('testVerifyThatTheAdminCanDeleteTheEmployee', async ({ page }) => {
  const requests = new Page(page);

  await requests.openRegistrationRequests();
  const userName = caseRecords.mine(USER_RECORD);
  await requests.searchEmployee(userName);
  checkEquals("Delete employee · the employee's row shows", await requests.rowsOfUser(userName, 1), 1);
  const countBefore = await requests.listCount();
  await requests.clickDeleteEmployee(userName);
  checkTrue('Delete employee · confirm message shows', await requests.deleteConfirmShown());
  await requests.clickConfirmOk();

  checkEquals('Delete employee · the row disappears', await requests.rowsOfUser(userName, 0), 0);
  checkEquals('Delete employee · list count goes down by 1', await requests.listCountBecomes(countBefore - 1), countBefore - 1);
  await requests.searchEmployee(userName);
  checkEquals('Delete employee · searching the user name returns no row', await requests.rowsOfUser(userName, 0), 0);
});
