package tests.web.plans;

import api.client.AppApi;
import api.services.WorkPlanApi;
import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import pages.WorkPlansPage;
import utils.RunIds;

import java.time.LocalDate;
import java.util.UUID;

import static utils.MethodHandlesWeb.*;

/** Plans: work plans and their shifts on the Work plans page. Plans and shifts a test needs first are made by API. */
public class PlansTests extends BaseTests {

    private static final String RUN = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
    private static final String DELETE_CURRENT_AND_FUTURE = "حذف المناوبة الحاليه و المستقبليه";

    /** "Trova Plan {run:290}" → this run's own value for that case */
    private static String fresh(String value) {
        return value.replaceAll("\\{run(?::(\\d+))?}", RUN + "$1");
    }

    /** Makes the plan by API and keeps its name for the clean-up; returns its id. */
    private static String madePlan(String login, String name, String country) {
        return WorkPlanApi.addPlan(AppApi.signedInAs(login), name, country);
    }

    /** Makes the plan and a daily shift in it by API. */
    private static String madePlanWithShift(String login, String plan, String country, String title, String startDate,
            String startTime, String endTime, String maxCheckout) {
        AppApi api = AppApi.signedInAs(login);
        String id = WorkPlanApi.addPlan(api, plan, country);
        WorkPlanApi.addShift(api, id, title, WorkPlanApi.day(startDate), startTime, endTime, maxCheckout);
        return id;
    }

    /** Opens the shift and puts one employee on it (set-up inside the screen test). */
    private void putEmployeeOnShift(LocalDate day, String title) {
        workPlansPage.openShiftDetails(day, title);
        workPlansPage.clickEditIcon();
        workPlansPage.addAnyEmployee();
        workPlansPage.saveShift();
        workPlansPage.confirmEditQuestion();
        myAssertEquals("Set-up · employee added", workPlansPage.toastShows("تم تعديل المناوبة بنجاح"), "تم تعديل المناوبة بنجاح");
        workPlansPage.toastGone();
        workPlansPage.closeDialog();
    }

    /** Takes the employee off the shift so the shift and its plan can be deleted. */
    private void takeEmployeeOffShift(LocalDate day, String title) {
        workPlansPage.openShiftDetails(day, title);
        workPlansPage.clickEditIcon();
        workPlansPage.removeEmployee();
        workPlansPage.saveShift();
        workPlansPage.confirmEditQuestion();
    }

    @Parameters("signedInAs")
    @Test(groups = "Web")
    public void logInProgrammatically(@Optional("Account Manager - Plan") String signedInAs) {
        signInOnce(signedInAs);
    }

    @Parameters({"shift_plan_name", "shift_plan_country"})
    @Test(groups = "Web")
    public void testVerifyThatG1VerifyThatAddingANewPlanSavesIt(@Optional("Trova Plan {run:290}") String planName,
            @Optional("مصر") String country) {
        String name = fresh(planName);
        workPlansPage.openWorkPlans();
        workPlansPage.clickAddPlan();
        workPlansPage.enterPlanName(name);
        workPlansPage.selectCountry(country);
        workPlansPage.turnOnEveryDay();
        workPlansPage.clickSave();
        RunIds.keep(WorkPlanApi.MADE_PLANS, name);

        myAssertEquals("Add plan · toast", workPlansPage.toastShows("تم إضافة خطة عمل بنجاح"), "تم إضافة خطة عمل بنجاح");
        myAssertTrue("Add plan · the plan is in the plan list", workPlansPage.planShown(name));
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country"})
    @Test(groups = "Web")
    public void testVerifyThatG2VerifyThatEditingAPlansDaysOffSavesIt(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:291}") String planName, @Optional("مصر") String country) {
        String name = fresh(planName);
        workPlansPage.openWorkPlans();
        madePlan(login, name, country);
        workPlansPage.reloadWorkPlans();
        workPlansPage.clickPlanMenuItem(name, "تعديل");
        workPlansPage.setDay("سبت", false);
        workPlansPage.setDay("جمعة", false);
        workPlansPage.clickSave();

        myAssertEquals("Edit plan · toast", workPlansPage.toastShows("تم تعديل الخطة بنجاح"), "تم تعديل الخطة بنجاح");
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_repeat", "shift_start_date",
            "shift_start_time", "shift_end_time", "shift_max_checkout_time"})
    @Test(groups = "Web")
    public void testVerifyThatG3VerifyThatAddingARegularShiftSavesItsTimes(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:292}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:292}") String shiftTitle, @Optional("daily") String repeat,
            @Optional("tomorrow") String startDate, @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime,
            @Optional("08:00 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        LocalDate day = WorkPlanApi.day(startDate);
        madePlan(login, plan, country);
        workPlansPage.reloadWorkPlans();
        workPlansPage.clickAddShift();
        workPlansPage.enterShiftTitle(title);
        workPlansPage.selectShiftPlan(plan);
        workPlansPage.selectRepeat(repeat);
        workPlansPage.chooseStartDate(day);
        workPlansPage.chooseTime("بداية الدوام", startTime);
        workPlansPage.chooseTime("نهاية الدوام", endTime);
        workPlansPage.chooseTime("الحد الأقصى لتسجيل الخروج", maxCheckout);
        workPlansPage.saveShift();

        myAssertEquals("Add shift · toast", workPlansPage.toastShows("تم إضافة المناوبة بنجاح"), "تم إضافة المناوبة بنجاح");
        workPlansPage.openShiftDetails(day, title);
        myAssertEquals("Shift details · start", workPlansPage.detail("بداية الدوام"), WorkPlanApi.time24(startTime));
        myAssertEquals("Shift details · end", workPlansPage.detail("نهاية الدوام"), WorkPlanApi.time24(endTime));
        myAssertEquals("Shift details · max check-out", workPlansPage.detail("الحد الأقصى لتسجيل الخروج"), WorkPlanApi.time24(maxCheckout));
        workPlansPage.closeDialog();
    }

    @Parameters({"shift_start_date"})
    @Test(groups = "Web")
    public void testVerifyThatG4VerifyThatANewShiftStartsTomorrowByDefault(@Optional("tomorrow") String startDate) {
        LocalDate day = WorkPlanApi.day(startDate);
        workPlansPage.openWorkPlans();
        workPlansPage.clickAddShift();

        myAssertEquals("New shift · start date", String.valueOf(workPlansPage.startDayShown()), String.valueOf(day)); // as dates: 9/11 = 09/11
        workPlansPage.closeDialog();
        myAssertTrue("New shift · the form closed without saving", workPlansPage.dialogClosed());
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_start_date", "shift_start_time",
            "shift_end_time", "shift_max_checkout_time"})
    @Test(groups = "Web")
    public void testVerifyThatG8VerifyThatRemovingTheEmployeeFromAShiftSavesIt(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:297}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:297}") String shiftTitle, @Optional("tomorrow") String startDate,
            @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime, @Optional("08:00 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        LocalDate day = WorkPlanApi.day(startDate);
        madePlanWithShift(login, plan, country, title, startDate, startTime, endTime, maxCheckout);
        workPlansPage.reloadWorkPlans();
        putEmployeeOnShift(day, title);

        takeEmployeeOffShift(day, title);

        myAssertEquals("Edit shift · toast", workPlansPage.toastShows("تم تعديل المناوبة بنجاح"), "تم تعديل المناوبة بنجاح");
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_start_date", "shift_start_time",
            "shift_end_time", "shift_max_checkout"})
    @Test(groups = "Web")
    public void testVerifyThatG5VerifyThatThePlanFilterShowsOnlyThatPlansShifts(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:294}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:294}") String shiftTitle, @Optional("tomorrow") String startDate,
            @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime, @Optional("6 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        LocalDate day = WorkPlanApi.day(startDate);
        madePlanWithShift(login, plan, country, title, startDate, startTime, endTime, maxCheckout);
        workPlansPage.reloadWorkPlans();
        workPlansPage.filterByPlan(plan);

        myAssertTrue("Plan filter · the plan's shift shows tomorrow", workPlansPage.shiftShown(day, title));
        myAssertEquals("Plan filter · shifts tomorrow", workPlansPage.shiftsOnDay(day, 1), 1);
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country"})
    @Test(groups = "Web")
    public void testVerifyThatG10VerifyThatAPlanWithNoShiftsIsDeleted(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:299}") String planName, @Optional("مصر") String country) {
        String plan = fresh(planName);
        workPlansPage.openWorkPlans();
        madePlan(login, plan, country);
        workPlansPage.reloadWorkPlans();
        workPlansPage.clickPlanMenuItem(plan, "حذف");
        workPlansPage.confirmDialog();

        myAssertEquals("Delete plan · toast", workPlansPage.toastShows("تم حذف الخطة بنجاح"), "تم حذف الخطة بنجاح");
        myAssertTrue("Delete plan · the plan is no longer in the list", workPlansPage.planGone(plan));
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_start_date", "shift_start_time",
            "shift_end_time", "shift_max_checkout_time"})
    @Test(groups = "Web")
    public void testVerifyThatG6VerifyThatAPlanWithShiftsCannotBeDeleted(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:295}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:295}") String shiftTitle, @Optional("tomorrow") String startDate,
            @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime, @Optional("08:00 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        madePlanWithShift(login, plan, country, title, startDate, startTime, endTime, maxCheckout);
        workPlansPage.reloadWorkPlans();
        workPlansPage.clickPlanMenuItem(plan, "حذف");
        workPlansPage.confirmDialog();

        myAssertEquals("Delete plan · toast", workPlansPage.toastShows("يوجد مناوبات مرتبطة بهذه الخطة"), "يوجد مناوبات مرتبطة بهذه الخطة");
        myAssertTrue("Delete plan · the plan is still in the list", workPlansPage.planShown(plan));
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_start_date", "shift_start_time",
            "shift_end_time", "shift_max_checkout_time"})
    @Test(groups = "Web")
    public void testVerifyThatG9VerifyThatAShiftWithNoEmployeesIsDeleted(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:298}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:298}") String shiftTitle, @Optional("tomorrow") String startDate,
            @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime, @Optional("08:00 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        LocalDate day = WorkPlanApi.day(startDate);
        madePlanWithShift(login, plan, country, title, startDate, startTime, endTime, maxCheckout);
        workPlansPage.reloadWorkPlans();
        workPlansPage.openShiftDetails(day, title);
        workPlansPage.clickDeleteIcon();
        workPlansPage.chooseDeleteScope(DELETE_CURRENT_AND_FUTURE);
        workPlansPage.confirmDialog();

        myAssertEquals("Delete shift · toast", workPlansPage.toastShows("تم حذف المناوبة بنجاح"), "تم حذف المناوبة بنجاح");
        myAssertTrue("Delete shift · the shift is gone from the calendar", workPlansPage.shiftGone(day, title));
    }

    @Parameters({"signedInAs", "shift_plan_name", "shift_plan_country", "shift_title", "shift_start_date", "shift_start_time",
            "shift_end_time", "shift_max_checkout_time"})
    @Test(groups = "Web")
    public void testVerifyThatG7VerifyThatAShiftWithAnEmployeeCannotBeDeleted(@Optional("Account Manager - Plan") String login,
            @Optional("Trova Plan {run:296}") String planName, @Optional("مصر") String country,
            @Optional("Trova Shift {run:296}") String shiftTitle, @Optional("tomorrow") String startDate,
            @Optional("10:00 am") String startTime, @Optional("05:00 pm") String endTime, @Optional("08:00 pm") String maxCheckout) {
        String plan = fresh(planName);
        String title = fresh(shiftTitle);
        workPlansPage.openWorkPlans();
        LocalDate day = WorkPlanApi.day(startDate);
        madePlanWithShift(login, plan, country, title, startDate, startTime, endTime, maxCheckout);
        workPlansPage.reloadWorkPlans();
        putEmployeeOnShift(day, title);

        try {
            workPlansPage.openShiftDetails(day, title);
            workPlansPage.clickDeleteIcon();
            workPlansPage.chooseDeleteScope(DELETE_CURRENT_AND_FUTURE);
            workPlansPage.confirmDialog();

            String toast = "لا يمكن حذف مناوبة مرتبطة بموظفين او ادارات";
            myAssertEquals("Delete shift · toast", workPlansPage.toastShows(toast), toast);
            myAssertTrue("Delete shift · the shift is still in the calendar", workPlansPage.shiftShown(day, title));
        } finally { // the employee goes off the shift so the shift and the plan can be deleted
            workPlansPage.toastGone();
            workPlansPage.closeDialog();
            takeEmployeeOffShift(day, title);
        }
    }
}
