package tests.api.health;

import api.client.AppApi;
import api.services.HealthApi;
import base.BaseApi;
import io.restassured.response.Response;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

import static utils.MethodHandlesWeb.myAssertTrue;

/**
 * API smoke check - works for any API: the env's API address (Trova → Test Data → Environments) answers without a
 * server error. The path comes from the suite ({@code <parameter name="healthPath" value="health"/>}), empty = the root.
 * Put your API's tests beside it: tests/api/<area>/<Area>ApiTests, calls through api/services on an api/client.
 */
public class HealthApiTests extends BaseApi {

    @Parameters("healthPath")
    @Test
    public void verifyThatTheApiAnswers(@Optional("") String healthPath) {
        Response response = new HealthApi(new AppApi()).answer(healthPath.startsWith("${") ? "" : healthPath);

        myAssertTrue("Health · HTTP status below 500 (was " + response.statusCode() + ")", response.statusCode() < 500);
    }
}
