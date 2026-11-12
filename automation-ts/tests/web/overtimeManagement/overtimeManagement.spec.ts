import { caseRecords } from '../../../src/run/caseRecords';
import { param } from '../../../src/run/blockParams';
import { checkContains, checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';
import { runSignInLine } from '../../../src/records/runSignInLine';
import { refusedPage } from '../../../src/web/pageFacts';
import { OvertimeRequestsPage } from '../../../src/web/pages/OvertimeRequestsPage';
import { OvertimeSettingsPage } from '../../../src/web/pages/OvertimeSettingsPage';
import { webTest as test } from '../../../src/web/webTest';
import { PENDING, REJECTED } from '../overtimeRecords';

/** Overtime Management - the TS twin of tests.web.overtimeManagement.OvertimeManagementTests (same names, steps, checks). */
const UNDER_ACTION = 'تحت الاجراء';
const REJECTED_WORD = 'مرفوض';
const APPROVED_WORD = 'مقبول';
const SUCCEEDED = 'تمت العملية بنجاح';
const NEGATIVE_BALANCE = 'يجب أن تكون القيمة 0 أو أكثر.';
const MIN_ABOVE_MAX = 'لا يمكن أن يكون الحد الأدنى للوقت أكبر من الحد الأقصى.';

/** passes only when the app really opened signed in (the page fixture signs in once and refuses a sign-in page) */
test('logInProgrammatically', async ({ page }) => {
  checkFalse(`${runSignInLine()} - the app opened signed in`, refusedPage(page.url()));
});

test('testVerifyThatTheMonthlyBalanceFieldShowsWhenOvertimeIsOn', async ({ page }) => {
  const settings = new OvertimeSettingsPage(page);
  await settings.openChangeAccountInformation();
  await settings.openOvertimeSettings();
  await settings.turnOvertimeOn();

  checkTrue('Monthly balance field shows', await settings.monthlyBalanceFieldShown());
  checkTrue('Empty means no limit hint shows', await settings.emptyMeansNoLimitShown());
});

test('testVerifyTheDetailsOfAPendingOvertimeRequest', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  const listStatus = await requests.listStatusOf(reason);
  await requests.viewRequest(reason);

  checkEquals('Details · status', await requests.detailsStatus(), UNDER_ACTION);
  checkEquals("Details · status is the list's word", await requests.detailsStatus(), listStatus);
  checkEquals('Details · decision rows', await requests.decisionRowsShown(), 0);
  await requests.closeDetails();
});

test('testVerifyThatARejectedRequestShowsWhoRejectedItAndWhy', async ({ page }) => {
  const reason = caseRecords.mine(REJECTED);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);

  checkEquals('Details · status', await requests.detailsStatus(), REJECTED_WORD);
  checkTrue('Details · rejected by shows a name', (await requests.rejectedBy()).trim() !== '');
  checkEquals('Details · rejection reason', await requests.rejectionReason(), param('reject_reason', 'Not needed'));
  await requests.closeDetails();
});

test('testVerifyThatRejectingWithAReasonRejectsTheRequest', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickReject();
  await requests.enterReasonAndConfirm(param('reject_reason', 'Not needed'));

  checkContains('Reject · message', await requests.successMessage(), SUCCEEDED);
  await requests.closeDetails();
  checkEquals('Reject · list status', await requests.listStatusBecomes(reason, REJECTED_WORD), REJECTED_WORD);
});

test('testVerifyThatApprovingAPendingRequestApprovesIt', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickApprove();
  await requests.enterReasonAndConfirm(param('approve_reason', 'Approved for overtime'));

  checkContains('Approve · message', await requests.successMessage(), SUCCEEDED);
  await requests.closeDetails();
  checkEquals('Approve · list status', await requests.listStatusBecomes(reason, APPROVED_WORD), APPROVED_WORD);
});

test('testVerifyThatANegativeMonthlyBalanceIsRefused', async ({ page }) => {
  const settings = new OvertimeSettingsPage(page);
  await settings.openChangeAccountInformation();
  await settings.openOvertimeSettings();
  await settings.turnOvertimeOn();
  const before = await settings.monthlyBalanceValue();
  await settings.enterMonthlyBalance(param('overtime_balance', '-5'));
  await settings.clickSave();

  checkEquals('Monthly balance · message', await settings.messageShows(NEGATIVE_BALANCE), NEGATIVE_BALANCE);
  await settings.reopenOvertimeSettings();
  checkEquals('Monthly balance · nothing saved', await settings.monthlyBalanceValue(), before);
});

test('testVerifyThatAMinimumDailyOvertimeAboveTheMaximumIsRefused', async ({ page }) => {
  const settings = new OvertimeSettingsPage(page);
  await settings.openChangeAccountInformation();
  await settings.openOvertimeSettings();
  await settings.turnOvertimeOn();
  const minBefore = await settings.minimumHoursValue();
  const maxBefore = await settings.maximumHoursValue();
  await settings.setMinimumDailyOvertime(param('overtime_min_hours', '4'));
  await settings.setMaximumDailyOvertime(param('overtime_max_hours', '3'));
  await settings.clickSave();

  checkEquals('Daily overtime · message', await settings.messageShows(MIN_ABOVE_MAX), MIN_ABOVE_MAX);
  await settings.reopenOvertimeSettings();
  checkEquals('Daily overtime · minimum not saved', await settings.minimumHoursValue(), minBefore);
  checkEquals('Daily overtime · maximum not saved', await settings.maximumHoursValue(), maxBefore);
});

test('testVerifyThatRejectingWithoutAReasonIsBlocked', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickReject();
  await requests.confirmWithoutReason();

  checkEquals('Reject · message', await requests.reasonRequiredMessage(), 'سبب الرفض مطلوب');
  await requests.cancelReasonWindow();
  await requests.closeDetails();
  checkEquals('Reject · request stays pending', await requests.listStatusOf(reason), UNDER_ACTION);
});
