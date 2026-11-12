import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkContains, checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';
import { RegistrationRequestsPage as Page } from '../../../src/web/pages/RegistrationRequestsPage';
import { webTest as test } from '../../../src/web/webTest';
import { ADDED_EMPLOYEE_USERS, PENDING_JOBS } from '../employeeAndLeavesRecords';

/** Employee and Leaves - the TS twin of tests.web.employeeAndLeaves.EmployeeAndLeavesTests (same names, steps, checks). */
const ADDED = 'تمت اضافة الموظف بنجاح';
const NOT_COMPLETE = 'غير مستكمل';
const NAME_RULE = 'يجب ان يكون الاسم بين 2 و 50 حرف ويجب ان يبدأ بحرف ولا يحتوي على أرقام';
const JOB_NUMBER_RULE = 'الرقم الوظيفي يجب ان يبدأ بحرف أو رقم ويجب ان يكون بين 1 و 20 حرف';

test('testAdminCanAddANewEmployeeWithAllRequiredFields', async ({ page }) => {
  const jobNumber = param('employee_job_number', 'SK{run}');
  const requests = new Page(page);

  await requests.clickRegistrationRequests();
  await requests.clickAddEmployee();
  await requests.insertField(Page.FIRST_NAME, param('employee_first_name', 'Skill'));
  await requests.insertField(Page.LAST_NAME, param('employee_last_name', 'Tester'));
  await requests.insertField(Page.USER_NAME, param('employee_user_name', 'o.hany+skill1+{run}@t2.sa'));
  await requests.insertField(Page.JOB_NUMBER, jobNumber);
  await requests.selectDepartment(param('employee_department', 'test'));
  await requests.clickSave();
  runRecords.keep(PENDING_JOBS, jobNumber); // the clean-up deletes only what this run made

  checkContains('Add employee · toast', await requests.toastText(), ADDED);
  checkTrue('Add employee · drawer closes', await requests.waitForDrawerToClose());
  checkEquals('Add employee · rows with the new job number', await requests.rowsFor(jobNumber), 1);
  checkContains('Add employee · new row status', await requests.rowText(jobNumber), NOT_COMPLETE);
});

test('testFirstNameWithNumbersIsRejected', async ({ page }) => {
  const requests = new Page(page);

  await requests.clickRegistrationRequests();
  await requests.clickAddEmployee();
  await requests.insertField(Page.FIRST_NAME, param('employee_first_name_with_numbers', 'Omar{run}'));
  await requests.pressTabIn(Page.FIRST_NAME);

  checkContains('First name · error', await requests.fieldErrorText(Page.FIRST_NAME), NAME_RULE);
  checkFalse('First name · Save stays disabled', await requests.saveIsEnabled());
});

test('testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests', async ({ page }) => {
  const first = param('employee_first_name', 'Omar');
  const last = param('employee_last_name', 'Testone');
  const userName = param('employee_user_name', 'omar.tc01+{run}@t2saas.sa');
  const jobNumber = param('employee_job_number', 'TC3110A{run}');
  const requests = new Page(page);

  await requests.openRegistrationRequests();
  const countBefore = await requests.listCount();
  await requests.clickAddEmployee();
  await requests.insertField(Page.FIRST_NAME, first);
  await requests.insertField(Page.LAST_NAME, last);
  await requests.insertField(Page.USER_NAME, userName);
  await requests.insertField(Page.JOB_NUMBER, jobNumber);
  await requests.pickAnyExistingDepartment();
  await requests.insertField(Page.JOB_TITLE, param('employee_job_title', 'QA'));
  await requests.clickSave();
  runRecords.keep(ADDED_EMPLOYEE_USERS, userName); // "Clean up - Delete the employee record" deletes it on the screen

  checkContains('Add employee · toast', await requests.toastText(), ADDED);
  checkTrue('Add employee · drawer closes', await requests.waitForDrawerToClose());
  checkEquals('Add employee · list count goes up by 1', await requests.listCountBecomes(countBefore + 1), countBefore + 1);

  await requests.searchEmployee(userName);
  checkEquals('Search · one row for the new user name', await requests.rowsOfUser(userName, 1), 1);
  const row = await requests.rowTextOfUser(userName);
  checkContains('Search · row shows the name', row, `${first} ${last}`);
  checkContains('Search · row shows the user name', row, userName);
  checkContains('Search · row shows the job number', row, jobNumber);
  checkContains('Search · row status', row, NOT_COMPLETE);
});

test('testVerifyThatJobNumberLongerThan20CharactersIsRejected', async ({ page }) => {
  const requests = new Page(page);

  await requests.openRegistrationRequests();
  await requests.clickAddEmployee();
  await requests.insertField(Page.JOB_NUMBER, param('employee_job_number', 'SK123456789012345678X{run}'));
  await requests.pressTabIn(Page.JOB_NUMBER);

  checkContains('Job number · error', await requests.fieldMessageShows(Page.JOB_NUMBER, JOB_NUMBER_RULE), JOB_NUMBER_RULE);
});

test('testSaveStaysDisabledWhileARequiredFieldIsEmpty', async ({ page }) => {
  const requests = new Page(page);

  await requests.clickRegistrationRequests();
  await requests.clickAddEmployee();
  await requests.insertField(Page.FIRST_NAME, 'Test');
  await requests.insertField(Page.LAST_NAME, 'Empty');
  await requests.insertField(Page.USER_NAME, 'testempty.job@t2.sa');
  await requests.selectDepartment('test');
  await requests.insertField(Page.JOB_NUMBER, param('employee_job_number_empty', ''));

  checkFalse('Job number empty · Save is disabled', await requests.saveIsEnabled());
});
