package api.services;

import api.client.ApiClient;
import api.client.AppApi;
import api.client.AppMobileApi;
import io.restassured.response.Response;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Overtime requests by API: the employee sends / deletes from the phone app, the manager's list shows them. */
public final class OvertimeApi {

    /** the status numbers the list uses */
    public static final int PENDING = 0;
    public static final int REJECTED = 2;

    private OvertimeApi() {
    }

    /** The manager's list of overtime requests of this year (newest first), each row a map of the answer's fields. */
    public static List<Map<String, Object>> list(AppApi manager) {
        int year = LocalDate.now().getYear();
        Map<String, Object> filter = new java.util.LinkedHashMap<>();
        filter.put("SearchTerm", "");
        filter.put("DepartmentsIDs", List.of());
        filter.put("DateFrom", year + "-01-01");
        filter.put("DateTo", year + "-12-31");
        filter.put("AssignToMe", false);
        filter.put("EmployeeGroups", List.of());
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("pageNumber", 1);
        body.put("pageSize", 100);
        body.put("data", filter);
        body.put("TimeZoneOffset", -180);
        body.put("Language", 0);
        Response answer = manager.post("OvertimeRequests/GetAllOvertimeRequests", body);
        List<Map<String, Object>> rows = ApiClient.ok(answer, "OvertimeRequests/GetAllOvertimeRequests").getList("Data.List");
        return rows == null ? new ArrayList<>() : rows;
    }

    /** The employee sends an overtime request for {@code day}; true when the app accepted it (HTTP 2xx and a true Status). */
    public static boolean create(AppMobileApi employee, LocalDate day, int hours, String reason) {
        Response answer = employee.call("POST /overtimeRequests/Create",
                Map.of("RequestDate", day + "T00:00:00", "RequestedMinutes", hours * 60, "Reason", reason));
        return accepted(answer);
    }

    /** The employee withdraws a still pending request. */
    public static void delete(AppMobileApi employee, int id) {
        Response answer = employee.post("overtimeRequests/Delete", Map.of("Id", id));
        ApiClient.ok(answer, "overtimeRequests/Delete");
    }

    private static boolean accepted(Response answer) {
        if (answer.statusCode() < 200 || answer.statusCode() >= 300) return false;
        Object status = answer.jsonPath().get("Status");
        return status == null || Boolean.parseBoolean(String.valueOf(status));
    }

    /** The row of the list whose Reason is exactly this text, or null. */
    public static Map<String, Object> byReason(List<Map<String, Object>> rows, String reason) {
        for (Map<String, Object> r : rows) {
            if (reason.equals(r.get("Reason"))) return r;
        }
        return null;
    }
}
