import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals } from '../../../src/report/checks';
import { LeavesPage } from '../../../src/web/pages/LeavesPage';
import { webTest as test } from '../../../src/web/webTest';
import { adminLeaves, LEAVE_DELETED, MADE_WEB_LEAVES, readyToAdd, webLeaveFor, webLeaveOfRun } from './webLeaveOfRun';

/**
 * A leave the admin adds on the web for the run's employee, and its delete - the TS twins of
 * tests.web.leaveRequests.LeaveRequestTests (verifyThatAdminCanAddNewLeaveSuccessfully, deleteLeaveRequest;
 * web/webLeavesTests passed on Test 5/5 and Stage 5/5, 2026-09-27). The admin's own leave is approved at once.
 */
const ADDED = 'تمت إضافة المغادرة بنجاح';
const DONE = 'تمت العملية بنجاح';
const ACCEPTED = 'مقبول';

test('testVerifyThatTheAdminCanAddALeaveForTheEmployeeFromTheWeb', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const leave = webLeaveFor(e);
  const type = `${leave.type}- ${leave.subType}`;
  const key = await readyToAdd(e, leave); // the run's own leftover on these days deleted first (run 994)
  const leaves = new LeavesPage(page);
  await leaves.openLeaves();
  runRecords.keep(MADE_WEB_LEAVES, key); // from Save on the leave may exist - the clean-up deletes it if the delete case does not
  await leaves.addLeave(leave);

  checkEquals('Add leave · toast', await leaves.toastShows(ADDED), ADDED);
  const id = await leaves.newestRequestIdOf(leave.fullName);
  const row = await leaves.requestRow(id);
  checkEquals('Requests list · employee', row.employee, leave.fullName);
  checkEquals('Requests list · status', row.status, ACCEPTED);
  checkEquals('Requests list · type', row.type, type);
  checkEquals('Requests list · from - to', `${row.from} - ${row.to}`, `${leave.from} - ${leave.to}`);

  const details = await leaves.requestDetails(id);
  checkEquals('Request details · employee', details.employee, leave.fullName);
  checkEquals('Request details · status', details.status, ACCEPTED);
  checkEquals('Request details · type', details.type, type);
  checkEquals('Request details · from - to', `${details.from} - ${details.to}`, `${leave.from} - ${leave.to}`);
  checkEquals('Request details · notes', details.notes, leave.notes);
  await leaves.closeDetails();
});

test('testVerifyThatTheAdminCanDeleteTheEmployeesLeaveFromTheWeb', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const { id, key } = await webLeaveOfRun(e);
  const leaves = new LeavesPage(page);
  await leaves.openLeaves();
  await leaves.deleteRequest(id);

  checkEquals('Delete leave · toast', await leaves.toastShows(DONE), DONE);
  checkEquals('Requests list · status after the delete (the row stays)', await leaves.statusBecomes(id, LEAVE_DELETED), LEAVE_DELETED);
  checkEquals('API · the leave is deleted', await (await adminLeaves()).statusOf(id), LEAVE_DELETED);
  runRecords.forget(MADE_WEB_LEAVES, key);
});
