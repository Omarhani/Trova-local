import { caseRecords } from '../../../src/run/caseRecords';
import { param } from '../../../src/run/blockParams';
import { checkEquals, checkFalse } from '../../../src/report/checks';
import { OvertimeRequestsPage } from '../../../src/web/pages/OvertimeRequestsPage';
import { OvertimeSettingsPage } from '../../../src/web/pages/OvertimeSettingsPage';
import { webTest as test } from '../../../src/web/webTest';
import { PENDING, REJECTED } from '../overtimeRecords';

/** Overtime Management traps (OvertimeManagementTrapsTests): each test is written exactly as its case says - they must fail. */
const APPROVED_WORD = 'مقبول';
const REJECTED_WORD = 'مرفوض';

async function overtimeSettingsOn(settings: OvertimeSettingsPage): Promise<void> {
  await settings.openChangeAccountInformation();
  await settings.openOvertimeSettings();
  await settings.turnOvertimeOn();
}

test('testVerifyThatAPendingOvertimeRequestShowsTheStatusApprovedInItsDetails', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);

  checkEquals('Details · status', await requests.detailsStatus(), APPROVED_WORD);
  await requests.closeDetails();
});

test('testVerifyThatARejectedRequestShowsNoRejectionReason', async ({ page }) => {
  const reason = caseRecords.mine(REJECTED);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);

  checkEquals('Details · rejection reason', await requests.rejectionReason(), '');
  checkEquals('Details · rejected by', await requests.rejectedBy(), '');
  await requests.closeDetails();
});

test('testVerifyThatTheMonthlyBalanceFieldIsHiddenWhenOvertimeIsOn', async ({ page }) => {
  const settings = new OvertimeSettingsPage(page);
  await overtimeSettingsOn(settings);

  checkFalse('Monthly balance field is not shown', await settings.monthlyBalanceFieldShown());
});

test('testVerifyThatAMinimumDailyOvertimeAboveTheMaximumIsSaved', async ({ page }) => {
  const minHours = param('overtime_min_hours', '4');
  const maxHours = param('overtime_max_hours', '3');
  const settings = new OvertimeSettingsPage(page);
  await overtimeSettingsOn(settings);
  await settings.setMinimumDailyOvertime(minHours);
  await settings.setMaximumDailyOvertime(maxHours);
  await settings.clickSave();

  checkEquals('Daily overtime · no message', await settings.anyMessage(), '');
  await settings.reopenOvertimeSettings();
  checkEquals('Daily overtime · minimum saved', await settings.minimumHoursValue(), minHours);
  checkEquals('Daily overtime · maximum saved', await settings.maximumHoursValue(), maxHours);
});

test('testVerifyThatRejectingWithAReasonApprovesTheRequest', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickReject();
  await requests.enterReasonAndConfirm(param('reject_reason', 'Not needed'));
  await requests.closeDetails();

  checkEquals('Reject · list status', await requests.listStatusBecomes(reason, APPROVED_WORD), APPROVED_WORD);
});

test('testVerifyThatApprovingAPendingRequestRejectsIt', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickApprove();
  await requests.confirmWithoutReason();
  await requests.closeDetails();

  checkEquals('Approve · list status', await requests.listStatusBecomes(reason, REJECTED_WORD), REJECTED_WORD);
});

test('testVerifyThatANegativeMonthlyBalanceIsSaved', async ({ page }) => {
  const balance = param('overtime_balance', '-5');
  const settings = new OvertimeSettingsPage(page);
  await overtimeSettingsOn(settings);
  await settings.enterMonthlyBalance(balance);
  await settings.clickSave();

  checkEquals('Monthly balance · no message', await settings.anyMessage(), '');
  await settings.reopenOvertimeSettings();
  checkEquals('Monthly balance · saved', await settings.monthlyBalanceValue(), balance);
});

test('testVerifyThatRejectingWithoutAReasonRejectsTheRequest', async ({ page }) => {
  const reason = caseRecords.mine(PENDING);
  const requests = new OvertimeRequestsPage(page);
  await requests.openOvertimeRequests();
  await requests.viewRequest(reason);
  await requests.clickReject();
  await requests.confirmWithoutReason();

  checkEquals('Reject · no message', await requests.reasonRequiredMessage(), '');
  await requests.cancelReasonWindow();
  await requests.closeDetails();
  checkEquals('Reject · list status', await requests.listStatusOf(reason), REJECTED_WORD);
});
