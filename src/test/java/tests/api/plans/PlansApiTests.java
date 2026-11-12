package tests.api.plans;

import api.client.AppApi;
import api.services.WorkPlanApi;
import base.BaseApi;
import org.testng.SkipException;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;
import utils.RunIds;

import java.time.LocalDate;
import java.util.List;

import static utils.MethodHandlesWeb.myAssertTrue;

/** Clean-up of the Plans suite: removes the plans this run made, their shifts first. */
public class PlansApiTests extends BaseApi {

    @Parameters({"signedInAs", "shift_start_date"})
    @Test(alwaysRun = true)
    public void cleanUpPlansProgrammatically(@Optional("Account Manager - Plan") String login, @Optional("tomorrow") String startDate) {
        List<String> names = RunIds.newestFirst(WorkPlanApi.MADE_PLANS);
        if (names.isEmpty()) {
            throw new SkipException("Nothing was kept by this run - nothing to delete");
        }
        AppApi api = AppApi.signedInAs(login);
        LocalDate start = WorkPlanApi.day(startDate);
        for (String name : names) { // shifts first, then the plan
            String id = WorkPlanApi.planId(api, name);
            if (id != null) {
                for (String shift : WorkPlanApi.shiftIds(api, id, start)) {
                    WorkPlanApi.deleteShift(api, shift, start);
                }
                WorkPlanApi.deletePlan(api, id);
            }
            myAssertTrue("Clean-up · plan " + name + " is gone", WorkPlanApi.planId(api, name) == null);
            RunIds.forget(WorkPlanApi.MADE_PLANS, name);
        }
    }
}
