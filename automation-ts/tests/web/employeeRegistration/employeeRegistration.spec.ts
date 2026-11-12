import { approvedEmployeeOfRun, pendingEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { fullName } from '../../../src/data/newEmployee';
import { param } from '../../../src/run/blockParams';
import { runEmployees } from '../../../src/run/runEmployee';
import { checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';
import { runSignInLine } from '../../../src/records/runSignInLine';
import { refusedPage } from '../../../src/web/pageFacts';
import { EmployeesPage } from '../../../src/web/pages/EmployeesPage';
import { RegistrationRequestsPage } from '../../../src/web/pages/RegistrationRequestsPage';
import { RegistrationReviewPage } from '../../../src/web/pages/RegistrationReviewPage';
import { webTest as test } from '../../../src/web/webTest';

/**
 * The admin's side of a new employee on the web - the TS twins of RegistrationTests.verifyThatTheAdminCanApproveRegistrationRequest
 * and EmployeesTests.verifyThatTheEmployeeViewShowsTheEmployeeData. The employee is this run's own (registered on the
 * app, else made by API first).
 */
const APPROVED = 'تمت العملية بنجاح';

/** passes only when the app really opened signed in (the page fixture signs in once per run and proves it) */
test('logInProgrammatically', async ({ page }) => {
  checkFalse(`${runSignInLine()} - the app opened signed in`, refusedPage(page.url()));
});

test('testVerifyThatTheAdminCanApproveTheRegistrationRequestFromTheWeb', async ({ page }) => {
  const e = await pendingEmployeeOfRun();
  await new RegistrationRequestsPage(page).openRegistrationRequests();
  const review = new RegistrationReviewPage(page);
  await review.searchByEmail(e.userName);
  const expected = param('expected_status', 'بانتظار التفعيل');
  checkEquals('Registration requests row · status before approving', await review.statusBecomes(e.userName, expected), expected);

  checkTrue('Review screen · every department and employee group ticked', await review.approve(e.userName, fullName(e)));
  checkEquals('Approve · toast', await review.toastShows(APPROVED), APPROVED);
  runEmployees.keep({ ...e, state: 'approved' });
  checkTrue('The request left the registration requests after approving', await review.requestGone(e.userName, 20));
});

test('testVerifyThatTheEmployeeViewShowsTheEmployee', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const users = new EmployeesPage(page);
  await users.openEmployees();
  await users.searchByUserName(e.userName);
  await users.openView(e.userName, fullName(e));

  checkEquals('Employee view · status', await users.viewStatusText(), param('status', 'مفعل'));
  checkEquals('Employee view · اسم الموظف', await users.cardValue('اسم الموظف'), fullName(e));
  checkEquals('Employee view · اسم المستخدم', await users.cardValue('اسم المستخدم'), e.userName);
  checkEquals('Employee view · الرقم الوظيفي', await users.cardValue('الرقم الوظيفي'), e.jobNumber);
  await users.closeView();
});
