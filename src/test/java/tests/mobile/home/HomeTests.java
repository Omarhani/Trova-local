package tests.mobile.home;

import base.BaseTests;
import org.testng.annotations.Test;

import static utils.MethodHandlesWeb.myAssertEquals;

/**
 * Mobile smoke check - works for any app: the app of Test Data → Environments → Mobile app starts on the phone.
 * Put your app's phone tests beside it (tests/mobile/login, tests/mobile/orders ...).
 */
public class HomeTests extends BaseTests {

    @Test(groups = "Mob")
    public void verifyThatTheAppOpens() {
        myAssertEquals("App in front · package", androidDriver.getCurrentPackage(), mobile().appPackage());
    }
}
