package tests.api.overtimeManagement;

import api.client.AppApi;
import api.client.AppMobileApi;
import api.services.OvertimeApi;
import base.BaseApi;
import org.testng.SkipException;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.CaseRecords;
import utils.RunIds;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static utils.MethodHandlesWeb.myAssertTrue;

/** Set-up (the employee's overtime requests) and clean-up (withdraw what the run made) of the Overtime Management suite. */
public class OvertimeManagementApiTests extends BaseApi {

    public static final String PENDING = "pending overtime request";
    public static final String REJECTED = "overtime request rejected";
    public static final String MADE_IDS = "overtimeRequestIds";
    private static final String ENDPOINT = "overtimeRequests/Create";

    /** The employee sends a request on the phone side; returns its reason text (the manager's list row), or null when not made. */
    private static String makePending(String employeeLogin, String managerLogin, String hours, String reason, int daysAhead) {
        String stamp = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String text = reason + " " + stamp;
        AppMobileApi employee = AppMobileApi.signedInAs(employeeLogin);
        boolean sent = false; // the app allows one request per day: take the next free day
        for (int day = daysAhead; day < daysAhead + 60 && !sent; day++) {
            sent = OvertimeApi.create(employee, LocalDate.now().plusDays(day), Integer.parseInt(hours), text);
        }
        if (!sent) return null;
        Map<String, Object> made = OvertimeApi.byReason(OvertimeApi.list(AppApi.signedInAs(managerLogin)), text);
        if (made == null) return null;
        RunIds.keep(MADE_IDS, String.valueOf(((Number) made.get("Id")).intValue()));
        return text;
    }

    @Parameters({"employee_login", "manager_login", "overtime_hours", "overtime_reason"})
    @Test
    public void setUpAnEmployeeWithAPendingOvertimeRequest(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("1") String hours,
            @Optional("Trova overtime check") String reason) {
        CaseRecords.madeForAll(PENDING, ENDPOINT, makePending(employeeLogin, managerLogin, hours, reason, 1));
    }

    @Parameters({"employee_login", "manager_login", "overtime_hours", "overtime_reason", "reject_reason"})
    @Test
    public void setUpAnOvertimeRequestRejected(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("1") String hours,
            @Optional("Trova overtime check") String reason, @Optional("Not needed") String rejectReason) {
        AppApi manager = AppApi.signedInAs(managerLogin);
        String text = makePending(employeeLogin, managerLogin, hours, reason, 2);
        if (text != null) {
            int id = ((Number) OvertimeApi.byReason(OvertimeApi.list(manager), text).get("Id")).intValue();
            manager.call("POST /OvertimeRequests/ApproveRejectOvertimeRequest",
                    Map.of("RequestId", List.of(id), "Status", OvertimeApi.REJECTED, "Reason", rejectReason));
        }
        CaseRecords.madeForAll(REJECTED, ENDPOINT, text);
    }

    @Parameters({"employee_login", "manager_login", "overtime_hours", "overtime_reason"})
    @Test
    public void setUpAPendingRequestForRejecting(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("1") String hours,
            @Optional("Trova overtime check") String reason) {
        CaseRecords.made("Verify that rejecting with a reason rejects the request", PENDING, ENDPOINT,
                makePending(employeeLogin, managerLogin, hours, reason, 3));
    }

    @Parameters({"employee_login", "manager_login", "overtime_hours", "overtime_reason"})
    @Test
    public void setUpAPendingRequestForApproving(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin, @Optional("1") String hours,
            @Optional("Trova overtime check") String reason) {
        CaseRecords.made("Verify that approving a pending request approves it", PENDING, ENDPOINT,
                makePending(employeeLogin, managerLogin, hours, reason, 4));
    }

    @Parameters({"employee_login", "manager_login"})
    @Test
    public void cleanUpProgrammatically(@Optional("Employee over Time") String employeeLogin,
            @Optional("Account manager over Time") String managerLogin) {
        List<String> ids = RunIds.newestFirst(MADE_IDS);
        if (ids.isEmpty()) {
            throw new SkipException("Nothing was kept by this run - nothing to delete");
        }
        AppMobileApi employee = null;
        AppApi manager = AppApi.signedInAs(managerLogin);
        for (String id : ids) { // a request the test approved or rejected stays: only a pending one can be withdrawn
            Map<String, Object> row = null;
            for (Map<String, Object> r : OvertimeApi.list(manager)) {
                if (id.equals(String.valueOf(((Number) r.get("Id")).intValue()))) row = r;
            }
            if (row != null && ((Number) row.get("Status")).intValue() == OvertimeApi.PENDING) {
                if (employee == null) employee = AppMobileApi.signedInAs(employeeLogin);
                OvertimeApi.delete(employee, Integer.parseInt(id));
                boolean gone = true;
                for (Map<String, Object> r : OvertimeApi.list(manager)) {
                    if (id.equals(String.valueOf(((Number) r.get("Id")).intValue()))) gone = false;
                }
                myAssertTrue("Clean-up · request " + id + " is gone", gone);
            }
        }
    }
}
