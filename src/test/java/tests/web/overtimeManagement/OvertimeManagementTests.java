package tests.web.overtimeManagement;

import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import tests.api.overtimeManagement.OvertimeManagementApiTests;
import utils.CaseRecords;

import static utils.MethodHandlesWeb.*;

public class OvertimeManagementTests extends BaseTests {

    private static final String UNDER_ACTION = "تحت الاجراء";
    private static final String REJECTED = "مرفوض";
    private static final String APPROVED = "مقبول";
    private static final String SUCCEEDED = "تمت العملية بنجاح";
    private static final String NEGATIVE_BALANCE = "يجب أن تكون القيمة 0 أو أكثر.";
    private static final String MIN_ABOVE_MAX = "لا يمكن أن يكون الحد الأدنى للوقت أكبر من الحد الأقصى.";

    @Parameters("signedInAs")
    @Test(groups = "Web")
    public void logInProgrammatically(@Optional("Account manager over Time") String signedInAs) {
        signInOnce(signedInAs);
    }

    @Test(groups = "Web")
    public void testVerifyThatTheMonthlyBalanceFieldShowsWhenOvertimeIsOn() {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();

        myAssertTrue("Monthly balance field shows", overtimeSettingsPage.monthlyBalanceFieldShown());
        myAssertTrue("Empty means no limit hint shows", overtimeSettingsPage.emptyMeansNoLimitShown());
    }

    @Test(groups = "Web")
    public void testVerifyTheDetailsOfAPendingOvertimeRequest() {
        String reason = CaseRecords.mine(OvertimeManagementApiTests.PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        String listStatus = overtimeRequestsPage.listStatusOf(reason);
        overtimeRequestsPage.viewRequest(reason);

        myAssertEquals("Details · status", overtimeRequestsPage.detailsStatus(), UNDER_ACTION);
        myAssertEquals("Details · status is the list's word", overtimeRequestsPage.detailsStatus(), listStatus);
        myAssertEquals("Details · decision rows", overtimeRequestsPage.decisionRowsShown(), 0);
        overtimeRequestsPage.closeDetails();
    }

    @Parameters({"reject_reason"})
    @Test(groups = "Web")
    public void testVerifyThatARejectedRequestShowsWhoRejectedItAndWhy(@Optional("Not needed") String rejectReason) {
        String reason = CaseRecords.mine(OvertimeManagementApiTests.REJECTED);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);

        myAssertEquals("Details · status", overtimeRequestsPage.detailsStatus(), REJECTED);
        myAssertTrue("Details · rejected by shows a name", !overtimeRequestsPage.rejectedBy().isBlank());
        myAssertEquals("Details · rejection reason", overtimeRequestsPage.rejectionReason(), rejectReason);
        overtimeRequestsPage.closeDetails();
    }

    @Parameters({"reject_reason"})
    @Test(groups = "Web")
    public void testVerifyThatRejectingWithAReasonRejectsTheRequest(@Optional("Not needed") String rejectReason) {
        String reason = CaseRecords.mine(OvertimeManagementApiTests.PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickReject();
        overtimeRequestsPage.enterReasonAndConfirm(rejectReason);

        myAssertContains("Reject · message", overtimeRequestsPage.successMessage(), SUCCEEDED);
        overtimeRequestsPage.closeDetails();
        myAssertEquals("Reject · list status", overtimeRequestsPage.listStatusBecomes(reason, REJECTED), REJECTED);
    }

    @Parameters({"approve_reason"})
    @Test(groups = "Web")
    public void testVerifyThatApprovingAPendingRequestApprovesIt(@Optional("Approved for overtime") String approveReason) {
        String reason = CaseRecords.mine(OvertimeManagementApiTests.PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickApprove();
        overtimeRequestsPage.enterReasonAndConfirm(approveReason);

        myAssertContains("Approve · message", overtimeRequestsPage.successMessage(), SUCCEEDED);
        overtimeRequestsPage.closeDetails();
        myAssertEquals("Approve · list status", overtimeRequestsPage.listStatusBecomes(reason, APPROVED), APPROVED);
    }

    @Parameters({"overtime_balance"})
    @Test(groups = "Web")
    public void testVerifyThatANegativeMonthlyBalanceIsRefused(@Optional("-5") String overtimeBalance) {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();
        String before = overtimeSettingsPage.monthlyBalanceValue();
        overtimeSettingsPage.enterMonthlyBalance(overtimeBalance);
        overtimeSettingsPage.clickSave();

        myAssertEquals("Monthly balance · message", overtimeSettingsPage.messageShows(NEGATIVE_BALANCE), NEGATIVE_BALANCE);
        overtimeSettingsPage.reopenOvertimeSettings();
        myAssertEquals("Monthly balance · nothing saved", overtimeSettingsPage.monthlyBalanceValue(), before);
    }

    @Parameters({"overtime_min_hours", "overtime_max_hours"})
    @Test(groups = "Web")
    public void testVerifyThatAMinimumDailyOvertimeAboveTheMaximumIsRefused(@Optional("4") String minHours, @Optional("3") String maxHours) {
        overtimeSettingsPage.openChangeAccountInformation();
        overtimeSettingsPage.openOvertimeSettings();
        overtimeSettingsPage.turnOvertimeOn();
        String minBefore = overtimeSettingsPage.minimumHoursValue();
        String maxBefore = overtimeSettingsPage.maximumHoursValue();
        overtimeSettingsPage.setMinimumDailyOvertime(minHours);
        overtimeSettingsPage.setMaximumDailyOvertime(maxHours);
        overtimeSettingsPage.clickSave();

        myAssertEquals("Daily overtime · message", overtimeSettingsPage.messageShows(MIN_ABOVE_MAX), MIN_ABOVE_MAX);
        overtimeSettingsPage.reopenOvertimeSettings();
        myAssertEquals("Daily overtime · minimum not saved", overtimeSettingsPage.minimumHoursValue(), minBefore);
        myAssertEquals("Daily overtime · maximum not saved", overtimeSettingsPage.maximumHoursValue(), maxBefore);
    }

    @Test(groups = "Web")
    public void testVerifyThatRejectingWithoutAReasonIsBlocked() {
        String reason = CaseRecords.mine(OvertimeManagementApiTests.PENDING);
        overtimeRequestsPage.openOvertimeRequests();
        overtimeRequestsPage.viewRequest(reason);
        overtimeRequestsPage.clickReject();
        overtimeRequestsPage.confirmWithoutReason();

        myAssertEquals("Reject · message", overtimeRequestsPage.reasonRequiredMessage(), "سبب الرفض مطلوب");
        overtimeRequestsPage.cancelReasonWindow();
        overtimeRequestsPage.closeDetails();
        myAssertEquals("Reject · request stays pending", overtimeRequestsPage.listStatusOf(reason), UNDER_ACTION);
    }
}
