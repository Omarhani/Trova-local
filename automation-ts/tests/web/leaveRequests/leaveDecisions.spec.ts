import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { LEAVE_APPROVED, LEAVE_PENDING, LEAVE_REJECTED } from '../../../src/api/services/leaveRequestsApi';
import { checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';
import { refusedPage } from '../../../src/web/pageFacts';
import { LeavesPage } from '../../../src/web/pages/LeavesPage';
import { webTest as test } from '../../../src/web/webTest';
import { LEAVE_DELETED } from './webLeaveOfRun';
import { requestOfTheEmployee, statusBecomes } from './requestOfTheEmployee';

/**
 * The admin decides on the web on a request the employee sent from the phone - the TS twins of
 * tests.hybrid.leaveRequests.AdminActions (verifyThatAdminDelete_ViewAndAccept_Accept_Reject_TheLeaveRequestAppearFromWeb,
 * one case per decision; hybrid/mobFullCycleForLeaves passed on Test 4/4 and Stage 4/4, 2026-09-26). Each case's request
 * is its own, sent by the run's employee's API (set-up); the decision is proved on the list AND in the employee's list.
 */
const DONE = 'تمت العملية بنجاح';
const ACCEPTED = 'مقبول';
const REJECTED = 'مرفوض';

/** passes only when the app really opened signed in (the page fixture signs in once per run and proves it) */
test('logInProgrammatically', async ({ page }) => {
  checkFalse('Sign-in · the admin opened the app signed in', refusedPage(page.url()));
});

test('testVerifyThatTheAdminCanAcceptALeaveRequestSentFromTheApp', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const { leaves, row } = await requestOfTheEmployee(e);
  const requests = new LeavesPage(page);
  await requests.openLeaves();
  await requests.accept(String(row.ID));

  checkEquals('Accept · toast', await requests.toastShows(DONE), DONE);
  checkEquals(`Requests list · request ${row.ID} status`, await requests.statusBecomes(String(row.ID), ACCEPTED), ACCEPTED);
  checkEquals("API · the request in the employee's own list is approved", await statusBecomes(leaves, row.ID, LEAVE_APPROVED), LEAVE_APPROVED);
});

test('testVerifyThatTheAdminCanRejectALeaveRequestSentFromTheApp', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const { leaves, row } = await requestOfTheEmployee(e);
  const requests = new LeavesPage(page);
  await requests.openLeaves();
  await requests.reject(String(row.ID));

  checkEquals('Reject · toast', await requests.toastShows(DONE), DONE);
  checkEquals(`Requests list · request ${row.ID} status`, await requests.statusBecomes(String(row.ID), REJECTED), REJECTED);
  checkEquals("API · the request in the employee's own list is rejected", await statusBecomes(leaves, row.ID, LEAVE_REJECTED), LEAVE_REJECTED);
});

test('testVerifyThatTheAdminCanDeleteALeaveRequestSentFromTheApp', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const { leaves, row } = await requestOfTheEmployee(e);
  const requests = new LeavesPage(page);
  await requests.openLeaves();
  await requests.deleteRequest(String(row.ID));

  checkEquals('Delete · toast', await requests.toastShows(DONE), DONE);
  checkEquals(`Requests list · request ${row.ID} status (the row stays)`, await requests.statusBecomes(String(row.ID), LEAVE_DELETED), LEAVE_DELETED);
  const left = (await leaves.list()).find((r) => r.ID === row.ID);
  checkTrue("API · the request no longer waits in the employee's own list", left === undefined || left.StatusId !== LEAVE_PENDING,
    `still Pending (status ${left?.StatusId})`);
});
