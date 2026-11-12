package api.services;

import api.client.ApiClient;
import api.client.AppApi;
import io.restassured.response.Response;
import utils.KnownCall;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Work plans and their shifts by API (web side): set-up of a plan / shift, and the clean-up that removes them again. */
public final class WorkPlanApi {

    /** run-context key: the names of the plans this run made (the clean-up finds them by name) */
    public static final String MADE_PLANS = "workPlanNames";
    private static final int EGYPT = 11;
    private static final DateTimeFormatter US = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    private WorkPlanApi() {
    }

    /** the day the data word means: "tomorrow" (also empty) or a date */
    public static LocalDate day(String word) {
        return word == null || word.isBlank() || word.trim().equalsIgnoreCase("tomorrow")
                ? LocalDate.now().plusDays(1) : LocalDate.parse(word.trim());
    }

    /** "10:00 am" / "05:00 pm" / "6 pm" → "10:00" / "17:00" / "18:00" */
    public static String time24(String text) {
        String t = text.trim().toLowerCase();
        boolean pm = t.endsWith("pm");
        String[] hm = t.replaceAll("[a-z\\s]", "").split(":");
        int hour = Integer.parseInt(hm[0]) % 12 + (pm ? 12 : 0);
        return String.format("%02d:%s", hour, hm.length > 1 ? hm[1] : "00");
    }

    /** Adds a plan for every day of the week; returns its id. */
    public static String addPlan(AppApi api, String name, String country) {
        if (!"مصر".equals(country)) {
            throw new IllegalStateException("The plan set-up knows only the country مصر (asked for \"" + country + "\")");
        }
        Response answer = api.call("POST /WorkPlan/AddWorkPlan", Map.of("Name", name, "CountryID", EGYPT));
        String id = ApiClient.ok(answer, "WorkPlan/AddWorkPlan").getString("Data");
        utils.RunIds.keep(MADE_PLANS, name);
        return id;
    }

    /** Adds a daily shift to the plan, starting on {@code start}; returns nothing (the clean-up lists the plan's shifts). */
    public static void addShift(AppApi api, String planId, String title, LocalDate start, String startTime, String endTime, String maxCheckout) {
        String from = time24(startTime);
        String to = time24(endTime);
        int hours = Integer.parseInt(to.substring(0, 2)) - Integer.parseInt(from.substring(0, 2));
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("Name", title);
        values.put("WorkPlanID", planId);
        values.put("StartDate", start + "T00:00:00.000Z");
        values.put("ShiftTime", from + " - " + to);
        values.put("ShiftStartTime", from);
        values.put("ShiftEndTime", to);
        values.put("TotalWorkingHours", hours);
        values.put("MaxCheckout", time24(maxCheckout));
        Response answer = api.call("POST /WorkPlanShift/AddWorkPlanShift", values);
        KnownCall.okOrSkip(answer, "the shift " + title);
    }

    /** The ids of the shifts of this plan that run on {@code day}. */
    public static List<String> shiftIds(AppApi api, String planId, LocalDate day) {
        Map<String, Object> filter = new LinkedHashMap<>();
        filter.put("DepartmentList", List.of());
        filter.put("search_type", "shift");
        filter.put("sDate", day.format(US));
        filter.put("eDate", day.format(US));
        filter.put("EmployeeList", List.of());
        filter.put("ShiftName", "");
        filter.put("HolidayName", "");
        filter.put("WorkPlanIds", List.of(planId));
        Response answer = api.call("POST /WorkPlan/GetAllShiftsByWorkPlan", Map.of("data", filter));
        List<Map<String, Object>> rows = ApiClient.ok(answer, "WorkPlan/GetAllShiftsByWorkPlan").getList("Data");
        List<String> ids = new ArrayList<>();
        if (rows != null) for (Map<String, Object> r : rows) {
            if (planId.equals(r.get("WorkPlanId"))) ids.add(String.valueOf(r.get("ID")));
        }
        return ids;
    }

    /** The id of the plan with this exact name, or null. */
    public static String planId(AppApi api, String name) {
        Response answer = api.call("POST /WorkPlan/GetAllWorkPlans");
        List<Map<String, Object>> rows = ApiClient.ok(answer, "WorkPlan/GetAllWorkPlans").getList("Data.List");
        if (rows != null) for (Map<String, Object> r : rows) {
            if (name.equals(r.get("Name"))) return String.valueOf(r.get("ID"));
        }
        return null;
    }

    /** Deletes the shift from its first day on (current and future ones). */
    public static void deleteShift(AppApi api, String shiftId, LocalDate start) {
        Response answer = api.call("POST /WorkPlanShift/DeleteWorkPlanShift",
                Map.of("ID", shiftId, "TypeOfDelete", "2", "DeletedDate", start + "T21:59:00.000Z"));
        ApiClient.ok(answer, "WorkPlanShift/DeleteWorkPlanShift");
    }

    /** Deletes the plan; the answer's own words when the app refuses. */
    public static void deletePlan(AppApi api, String planId) {
        Response answer = api.call("POST /WorkPlan/DeleteWorkPlan", Map.of("data", planId));
        ApiClient.ok(answer, "WorkPlan/DeleteWorkPlan");
        Object status = answer.jsonPath().get("Status");
        if (status != null && !Boolean.parseBoolean(String.valueOf(status))) {
            throw new AssertionError("WorkPlan/DeleteWorkPlan: " + utils.AppReason.of(answer));
        }
    }
}
