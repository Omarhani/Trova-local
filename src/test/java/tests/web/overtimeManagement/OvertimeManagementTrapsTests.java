package tests.web.overtimeManagement;

import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.CaseRecords;

import static utils.MethodHandlesWeb.*;

/** Overtime Management traps: each test is written exactly as its case says. */
public class OvertimeManagementTrapsTests extends BaseTests {

    private static final String PENDING = "pending overtime request";
    private static final String APPROVED = "مقبول";
    private static final String REJECTED = "مرفوض";

    @Test(groups = "Web")
    public void testVerifyThatAPendingOvertimeRequestShowsTheStatusApprovedInItsDetails() {
        String reason = CaseRecords.mine(PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);

        myAssertEquals("Details · status", overtimeRequestsPage.detailsStatus(), APPROVED);
        overtimeRequestsPage.closeDetails();
    }

    @Test(groups = "Web")
    public void testVerifyThatARejectedRequestShowsNoRejectionReason() {
        String reason = CaseRecords.mine("overtime request rejected");
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);

        myAssertEquals("Details · rejection reason", overtimeRequestsPage.rejectionReason(), "");
        myAssertEquals("Details · rejected by", overtimeRequestsPage.rejectedBy(), "");
        overtimeRequestsPage.closeDetails();
    }

    @Test(groups = "Web")
    public void testVerifyThatTheMonthlyBalanceFieldIsHiddenWhenOvertimeIsOn() {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();

        myAssertTrue("Monthly balance field is not shown", !overtimeSettingsPage.monthlyBalanceFieldShown());
    }

    @Parameters({"overtime_min_hours", "overtime_max_hours"})
    @Test(groups = "Web")
    public void testVerifyThatAMinimumDailyOvertimeAboveTheMaximumIsSaved(@Optional("4") String minHours, @Optional("3") String maxHours) {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();
        overtimeSettingsPage.setMinimumDailyOvertime(minHours);
        overtimeSettingsPage.setMaximumDailyOvertime(maxHours);
        overtimeSettingsPage.clickSave();

        myAssertEquals("Daily overtime · no message", overtimeSettingsPage.anyMessage(), "");
        overtimeSettingsPage.reopenOvertimeSettings();
        myAssertEquals("Daily overtime · minimum saved", overtimeSettingsPage.minimumHoursValue(), minHours);
        myAssertEquals("Daily overtime · maximum saved", overtimeSettingsPage.maximumHoursValue(), maxHours);
    }

    @Parameters({"reject_reason"})
    @Test(groups = "Web")
    public void testVerifyThatRejectingWithAReasonApprovesTheRequest(@Optional("Not needed") String rejectReason) {
        String reason = CaseRecords.mine(PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickReject();
        overtimeRequestsPage.enterReasonAndConfirm(rejectReason);
        overtimeRequestsPage.closeDetails();

        myAssertEquals("Reject · list status", overtimeRequestsPage.listStatusBecomes(reason, APPROVED), APPROVED);
    }

    @Test(groups = "Web")
    public void testVerifyThatApprovingAPendingRequestRejectsIt() {
        String reason = CaseRecords.mine(PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickApprove();
        overtimeRequestsPage.confirmWithoutReason();
        overtimeRequestsPage.closeDetails();

        myAssertEquals("Approve · list status", overtimeRequestsPage.listStatusBecomes(reason, REJECTED), REJECTED);
    }

    @Parameters({"overtime_balance"})
    @Test(groups = "Web")
    public void testVerifyThatANegativeMonthlyBalanceIsSaved(@Optional("-5") String overtimeBalance) {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();
        overtimeSettingsPage.enterMonthlyBalance(overtimeBalance);
        overtimeSettingsPage.clickSave();

        myAssertEquals("Monthly balance · no message", overtimeSettingsPage.anyMessage(), "");
        overtimeSettingsPage.reopenOvertimeSettings();
        myAssertEquals("Monthly balance · saved", overtimeSettingsPage.monthlyBalanceValue(), overtimeBalance);
    }

    @Test(groups = "Web")
    public void testVerifyThatRejectingWithoutAReasonRejectsTheRequest() {
        String reason = CaseRecords.mine(PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickReject();
        overtimeRequestsPage.confirmWithoutReason();

        myAssertEquals("Reject · no message", overtimeRequestsPage.reasonRequiredMessage(), "");
        overtimeRequestsPage.cancelReasonWindow();
        overtimeRequestsPage.closeDetails();
        myAssertEquals("Reject · list status", overtimeRequestsPage.listStatusOf(reason), REJECTED);
    }
}
