package tests.web.emloyess2;

import base.BaseTests;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import pages.RegistrationRequestsPage;
import utils.CaseRecords;

import java.util.UUID;

import static utils.MethodHandlesWeb.*;

public class Emloyess2Tests extends BaseTests {

    private static final String RUN = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    private static final String USER_RECORD = "the new employee's user name";
    private static final String LAST_NAME_RECORD = "the new employee's last name";
    private static final String JOB_RECORD = "the new employee's job number";

    private static String fresh(String value) {
        return value.replace("{run}", RUN);
    }

    @Test(groups = "Web")
    @Parameters({"employee_first_name", "employee_last_name", "employee_user_name", "employee_job_number", "employee_job_title"})
    public void testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests(@Optional("Omar") String first, @Optional("Testone") String last,
            @Optional("omar.tc01+{run}@t2saas.sa") String user, @Optional("TC3110A{run}") String job, @Optional("QA") String jobTitle) {
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
        CaseRecords.madeForAll(USER_RECORD, null, userName);
        CaseRecords.madeForAll(LAST_NAME_RECORD, null, last);
        CaseRecords.madeForAll(JOB_RECORD, null, jobNumber);

        myAssertContains("Add employee · toast", registrationRequestsPage.toastText(), "تمت اضافة الموظف بنجاح");
        myAssertTrue("Add employee · drawer closes", registrationRequestsPage.waitForDrawerToClose());
        myAssertEquals("Add employee · list count goes up by 1", registrationRequestsPage.listCountBecomes(countBefore + 1), countBefore + 1);
        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Add employee · rows with the new user name", registrationRequestsPage.rowsOfUser(userName, 1), 1);
        String row = registrationRequestsPage.rowTextOfUser(userName);
        myAssertContains("Add employee · row name", row, first + " " + last);
        myAssertContains("Add employee · row user name", row, userName);
        myAssertContains("Add employee · row job number", row, jobNumber);
        myAssertContains("Add employee · row status", row, "غير مستكمل");
    }

    @Test(groups = "Web")
    @Parameters({"employee_first_name", "employee_job_title"})
    public void testVerifyThatTheAdminCanEditTheNewEmployeesData(@Optional("Omarr") String first, @Optional("Senior QA") String jobTitle) {
        registrationRequestsPage.openRegistrationRequests();
        String userName = CaseRecords.mine(USER_RECORD);
        String last = CaseRecords.mine(LAST_NAME_RECORD);
        String jobNumber = CaseRecords.mine(JOB_RECORD);
        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Edit employee · the employee's row shows", registrationRequestsPage.rowsOfUser(userName, 1), 1);
        registrationRequestsPage.clickEditEmployee(userName);
        registrationRequestsPage.insertField(RegistrationRequestsPage.FIRST_NAME, first);
        registrationRequestsPage.insertField(RegistrationRequestsPage.JOB_TITLE, jobTitle);
        registrationRequestsPage.clickSave();

        myAssertContains("Edit employee · toast", registrationRequestsPage.toastText(), "تم تعديل بيانات الموظف بنجاح");
        myAssertTrue("Edit employee · drawer closes", registrationRequestsPage.waitForDrawerToClose());
        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Edit employee · rows with the user name", registrationRequestsPage.rowsOfUser(userName, 1), 1);
        myAssertContains("Edit employee · row name", registrationRequestsPage.rowTextOfUser(userName), first + " " + last);
        registrationRequestsPage.clickEditEmployee(userName);
        myAssertEquals("Edit employee · job title", registrationRequestsPage.fieldValueBecomes(RegistrationRequestsPage.JOB_TITLE, jobTitle), jobTitle);
        myAssertEquals("Edit employee · user name unchanged", registrationRequestsPage.fieldValueBecomes(RegistrationRequestsPage.USER_NAME, userName), userName);
        myAssertEquals("Edit employee · job number unchanged", registrationRequestsPage.fieldValueBecomes(RegistrationRequestsPage.JOB_NUMBER, jobNumber), jobNumber);
        registrationRequestsPage.closeDrawer();
    }

    @Test(groups = "Web")
    public void testVerifyThatTheAdminCanDeleteTheEmployee() {
        registrationRequestsPage.openRegistrationRequests();
        String userName = CaseRecords.mine(USER_RECORD);
        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Delete employee · the employee's row shows", registrationRequestsPage.rowsOfUser(userName, 1), 1);
        int countBefore = registrationRequestsPage.listCount();
        registrationRequestsPage.clickDeleteEmployee(userName);
        myAssertTrue("Delete employee · confirm message shows", registrationRequestsPage.deleteConfirmShown());
        registrationRequestsPage.clickConfirmOk();

        myAssertEquals("Delete employee · the row disappears", registrationRequestsPage.rowsOfUser(userName, 0), 0);
        myAssertEquals("Delete employee · list count goes down by 1", registrationRequestsPage.listCountBecomes(countBefore - 1), countBefore - 1);
        registrationRequestsPage.searchEmployee(userName);
        myAssertEquals("Delete employee · searching the user name returns no row", registrationRequestsPage.rowsOfUser(userName, 0), 0);
    }
}
