package tests.api.overtimeManagement;

import api.client.AppApi;
import api.client.AppMobileApi;
import api.services.OvertimeApi;
import base.BaseApi;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.CaseRecords;
import utils.PutBack;
import utils.RunIds;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Set-up blocks of the Overtime Management traps suite: each makes the employee's request the cases below it use. */
public class OvertimeManagementTrapsApiTests extends BaseApi {

    private static final String PENDING = "pending overtime request";
    private static final String REJECTED = "overtime request rejected";
    private static final String CREATE = "overtimeRequests/Create";

    /** The employee sends a request; returns its reason text (the row's key) and keeps the id for the clean-up, or null. */
    private static String send(String employeeLogin, String managerLogin, String reason, int daysAhead, int[] idOut) {
        String stamp = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String text = reason + " " + stamp;
        AppMobileApi employee = AppMobileApi.signedInAs(employeeLogin);
        boolean sent = false; // the app allows one request per day: take the next free day
        for (int day = daysAhead; day < daysAhead + 60 && !sent; day++) {
            sent = OvertimeApi.create(employee, LocalDate.now().plusDays(day), 1, text);
        }
        if (!sent) return null;
        Map<String, Object> made = OvertimeApi.byReason(OvertimeApi.list(AppApi.signedInAs(managerLogin)), text);
        if (made == null) return null;
        idOut[0] = ((Number) made.get("Id")).intValue();
        RunIds.keep(OvertimeManagementApiTests.MADE_IDS, String.valueOf(idOut[0]));
        return text;
    }

    @Parameters({"employee_login", "manager_login", "overtime_reason"})
    @Test
    public void setUpPendingOvertimeRequestForViews(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("Trova overtime check") String reason) {
        CaseRecords.madeForAll(PENDING, CREATE, send(employeeLogin, managerLogin, reason, 1, new int[1]));
    }

    @Parameters({"employee_login", "manager_login", "overtime_reason", "reject_reason"})
    @Test
    public void setUpRejectedOvertimeRequest(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("Trova overtime check") String reason,
            @Optional("Not needed") String rejectReason) {
        int[] id = new int[1];
        String text = send(employeeLogin, managerLogin, reason, 2, id);
        if (text != null) {
            AppApi manager = AppApi.signedInAs(managerLogin);
            manager.post("OvertimeRequests/ApproveRejectOvertimeRequest",
                    Map.of("RequestId", List.of(id[0]), "Status", OvertimeApi.REJECTED, "Reason", rejectReason));
            PutBack.notDeleted("rejected overtime request", "the app does not delete a decided request");
        }
        CaseRecords.madeForAll(REJECTED, "OvertimeRequests/ApproveRejectOvertimeRequest", text);
    }

    @Parameters({"employee_login", "manager_login", "overtime_reason"})
    @Test
    public void setUpPendingOvertimeRequestForRejectWithReason(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("Trova overtime check") String reason) {
        CaseRecords.made("Verify that rejecting with a reason approves the request", PENDING, CREATE,
                send(employeeLogin, managerLogin, reason, 1, new int[1]));
    }

    @Parameters({"employee_login", "manager_login", "overtime_reason"})
    @Test
    public void setUpPendingOvertimeRequestForApprove(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("Trova overtime check") String reason) {
        CaseRecords.made("Verify that approving a pending request rejects it", PENDING, CREATE,
                send(employeeLogin, managerLogin, reason, 1, new int[1]));
    }
}
