package tests.api.employeeAndLeaves;

import apis.services.AvailoApi;
import base.BaseApi;
import org.testng.SkipException;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.RunIds;

import java.util.List;

import static utils.MethodHandlesWeb.myAssertTrue;

/** Set-up (sign in once by API) and clean-up (delete what the run made) of the Employee and Leaves suite. */
public class EmployeeAndLeavesApiTests extends BaseApi {

    public static final String PENDING_JOBS = "pendingJobNumbers";

    @Parameters("signedInAs")
    @Test
    public void logInProgrammatically(@Optional("Admin") String signedInAs) {
        AvailoApi.Login login = AvailoApi.login(signedInAs);
        myAssertTrue("Sign-in · token received", login.token() != null && !login.token().isBlank());
    }

    @Parameters("signedInAs")
    @Test
    public void cleanUpProgrammatically(@Optional("Admin") String signedInAs) {
        List<String> jobs = RunIds.newestFirst(PENDING_JOBS);
        if (jobs.isEmpty()) {
            throw new SkipException("Nothing was kept by this run - nothing to delete");
        }
        AvailoApi.Login login = AvailoApi.login(signedInAs);
        for (String job : jobs) {
            String id = AvailoApi.pendingUserId(login, job);
            if (id != null) {
                AvailoApi.deletePendingUser(login, id);
            }
            myAssertTrue("Clean-up · request " + job + " is gone", AvailoApi.pendingUserId(login, job) == null);
        }
    }
}
