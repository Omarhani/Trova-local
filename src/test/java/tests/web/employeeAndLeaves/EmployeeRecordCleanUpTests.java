package tests.web.employeeAndLeaves;

import base.BaseTests;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.RunIds;

import java.util.List;

import static utils.MethodHandlesWeb.*;

/** Clean-up on the screen: deletes the employee requests a test kept under a key, newest first. */
public class EmployeeRecordCleanUpTests extends BaseTests {

    @Test(alwaysRun = true)
    @Parameters("recordKey")
    public void deleteEmployeeRecord(String recordKey) {
        registrationRequestsPage.openRegistrationRequests();
        List<String> userNames = RunIds.newestFirst(recordKey);
        if (userNames.isEmpty()) {
            System.out.println("Clean-up: nothing kept under " + recordKey + " - nothing to delete");
            return;
        }
        System.out.println("Clean-up on the screen - learn the delete call to make it faster");
        for (String userName : userNames) {
            myAssertTrue("Clean-up · employee request deleted", registrationRequestsPage.deleteEmployeeRequest(userName));
            RunIds.forget(recordKey, userName);
        }
    }
}
