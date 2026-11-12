package tests.web.employeeAndLeaves;

import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import pages.RegistrationRequestsPage;
import tests.api.employeeAndLeaves.EmployeeAndLeavesApiTests;
import utils.RunIds;

import java.util.UUID;

import static utils.MethodHandlesWeb.*;

public class EmployeeAndLeavesTests extends BaseTests {

    private static final String RUN = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    private static final String NAME_RULE = "يجب ان يكون الاسم بين 2 و 50 حرف ويجب ان يبدأ بحرف ولا يحتوي على أرقام";

    private static String fresh(String value) {
        return value.replace("{run}", RUN);
    }

    @Test(groups = "Web")
    @Parameters({"employee_first_name", "employee_last_name", "employee_user_name", "employee_job_number", "employee_department"})
    public void testAdminCanAddANewEmployeeWithAllRequiredFields(@Optional("Skill") String first, @Optional("Tester") String last,
            @Optional("o.hany+skill1+{run}@t2.sa") String user, @Optional("SK{run}") String job, @Optional("test") String department) {
        String userName = fresh(user);
        String jobNumber = fresh(job);
        registrationRequestsPage.clickRegistrationRequests();
        registrationRequestsPage.clickAddEmployee();
        registrationRequestsPage.insertField(RegistrationRequestsPage.FIRST_NAME, first);
        registrationRequestsPage.insertField(RegistrationRequestsPage.LAST_NAME, last);
        registrationRequestsPage.insertField(RegistrationRequestsPage.USER_NAME, userName);
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_NUMBER, jobNumber);
        registrationRequestsPage.selectDepartment(department);
        registrationRequestsPage.clickSave();
        RunIds.keep(EmployeeAndLeavesApiTests.PENDING_JOBS, jobNumber);

        myAssertContains("Add employee · toast", registrationRequestsPage.toastText(), "تمت اضافة الموظف بنجاح");
        myAssertTrue("Add employee · drawer closes", registrationRequestsPage.waitForDrawerToClose());
        myAssertEquals("Add employee · rows with the new job number", registrationRequestsPage.rowsFor(jobNumber), 1);
        myAssertContains("Add employee · new row status", registrationRequestsPage.rowText(jobNumber), "غير مستكمل");
    }

    @Test(groups = "Web")
    @Parameters({"employee_first_name_with_numbers"})
    public void testFirstNameWithNumbersIsRejected(@Optional("Omar{run}") String first) {
        registrationRequestsPage.clickRegistrationRequests();
        registrationRequestsPage.clickAddEmployee();
        registrationRequestsPage.insertField(RegistrationRequestsPage.FIRST_NAME, fresh(first));
        registrationRequestsPage.pressTabIn(RegistrationRequestsPage.FIRST_NAME);

        myAssertContains("First name · error", registrationRequestsPage.fieldErrorText(RegistrationRequestsPage.FIRST_NAME), NAME_RULE);
        myAssertFalse("First name · Save stays disabled", registrationRequestsPage.saveIsEnabled());
    }

    public static final String ADDED_EMPLOYEE_USERS = "added_employee_users";
    private static final String JOB_NUMBER_RULE = "الرقم الوظيفي يجب ان يبدأ بحرف أو رقم ويجب ان يكون بين 1 و 20 حرف";

    @Test(groups = "Web")
    @Parameters({"employee_first_name", "employee_last_name", "employee_user_name", "employee_job_number", "employee_job_title"})
    public void testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests(@Optional("Omar") String first,
            @Optional("Testone") String last, @Optional("omar.tc01+{run}@t2saas.sa") String user,
            @Optional("TC3110A{run}") String job, @Optional("QA") String jobTitle) {
        String userName = fresh(user);
        String jobNumber = fresh(job);
        registrationRequestsPage.openRegistrationRequests();
        int countBefore = registrationRequestsPage.listCount();
        registrationRequestsPage.clickAddEmployee();
        registrationRequestsPage.insertField(RegistrationRequestsPage.FIRST_NAME, first);
        registrationRequestsPage.insertField(RegistrationRequestsPage.LAST_NAME, last);
        registrationRequestsPage.insertField(RegistrationRequestsPage.USER_NAME, userName);
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_NUMBER, jobNumber);
        registrationRequestsPage.pickAnyExistingDepartment();
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_TITLE, jobTitle);
        registrationRequestsPage.clickSave();
        RunIds.keep(ADDED_EMPLOYEE_USERS, userName);

        myAssertContains("Add employee · toast", registrationRequestsPage.toastText(), "تمت اضافة الموظف بنجاح");
        myAssertTrue("Add employee · drawer closes", registrationRequestsPage.waitForDrawerToClose());
        myAssertEquals("Add employee · list count goes up by 1", registrationRequestsPage.listCountBecomes(countBefore + 1), countBefore + 1);

        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Search · one row for the new user name", registrationRequestsPage.rowsOfUser(userName, 1), 1);
        String row = registrationRequestsPage.rowTextOfUser(userName);
        myAssertContains("Search · row shows the name", row, first + " " + last);
        myAssertContains("Search · row shows the user name", row, userName);
        myAssertContains("Search · row shows the job number", row, jobNumber);
        myAssertContains("Search · row status", row, "غير مستكمل");
    }

    @Test(groups = "Web")
    @Parameters({"employee_job_number"})
    public void testVerifyThatJobNumberLongerThan20CharactersIsRejected(@Optional("SK123456789012345678X{run}") String job) {
        registrationRequestsPage.openRegistrationRequests();
        registrationRequestsPage.clickAddEmployee();
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_NUMBER, fresh(job));
        registrationRequestsPage.pressTabIn(RegistrationRequestsPage.JOB_NUMBER);

        myAssertContains("Job number · error", registrationRequestsPage.fieldMessageShows(RegistrationRequestsPage.JOB_NUMBER, JOB_NUMBER_RULE), JOB_NUMBER_RULE);
    }

    @Test(groups = "Web")
    @Parameters({"employee_job_number_empty"})
    public void testSaveStaysDisabledWhileARequiredFieldIsEmpty(@Optional("") String job) {
        registrationRequestsPage.clickRegistrationRequests();
        registrationRequestsPage.clickAddEmployee();
        registrationRequestsPage.insertField(RegistrationRequestsPage.FIRST_NAME, "Test");
        registrationRequestsPage.insertField(RegistrationRequestsPage.LAST_NAME, "Empty");
        registrationRequestsPage.insertField(RegistrationRequestsPage.USER_NAME, "testempty.job@t2.sa");
        registrationRequestsPage.selectDepartment("test");
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_NUMBER, job);

        myAssertFalse("Job number empty · Save is disabled", registrationRequestsPage.saveIsEnabled());
    }
}
