package demo;

import org.testng.Assert;
import org.testng.annotations.Test;

/**
 * DEF-122 / DEF-163: dummy tests for Test 8094. Local to the Test environment's folder, never committed. The 6 [demo]
 * suites in suiteFiles/ point at these: 3 pass (they only print a line) and 3 fail on purpose, and each suite's name
 * says which ("will pass" / "will fail").
 */
public class DemoPrintTests {

    // ---- will fail ----

    @Test(groups = "Demo")
    public void cartPrints() {
        System.out.println("[demo] Cart: 2 items added, total 120.00");
        Assert.assertEquals("120.00", "110.00", "[demo] Cart fails on purpose: the total should be 110.00");
    }

    @Test(groups = "Demo")
    public void appStartPrints() {
        System.out.println("[demo] App start: home screen in 4.8 s");
        Assert.assertTrue(4.8 <= 2.0, "[demo] App start fails on purpose: the home screen should open within 2 s");
    }

    @Test(groups = "Demo")
    public void loginPrints() {
        System.out.println("[demo] Login: 'Wrong password' shown for the right password");
        Assert.fail("[demo] Login fails on purpose: the right password should log in");
    }

    // ---- will pass ----

    @Test(groups = "Demo")
    public void paymentPrints() {
        System.out.println("[demo] Payment: card accepted");
    }

    @Test(groups = "Demo")
    public void helpPrints() {
        System.out.println("[demo] Help: 12 links found");
    }

    @Test(groups = "Demo")
    public void searchPrints() {
        System.out.println("[demo] Search: 5 results for 'shoes'");
    }
}
