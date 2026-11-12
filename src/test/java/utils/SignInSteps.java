package utils;

import org.openqa.selenium.WebDriver;

/**
 * Omar 2026-10-25 - the house sign-in steps of a test (the same names in web, hybrid and mobile-with-web suites):
 * <pre>
 *   utilsTests.loginByApi("Admin");      // the app's own sign-in calls (Test Data recipe), keys into the browser, open
 *   utilsTests.loginProgrammatically();  // a later block: the same sign-in's keys again - no sign-in page, no new sign-in
 * </pre>
 * One API sign-in per run ({@link ApiSignIn}); its token is the one every API set-up and clean-up uses
 * ({@link SignInToken#bearer}). A suite never signs in on the screen.
 */
public class SignInSteps {

    protected WebDriver driver;
    /** the login the run signed in as (loginByApi), for loginProgrammatically() */
    private static volatile String signedInAs;

    /** signs in as {@code login} by API (once per run) and opens the app signed in; fails once with the app's reason */
    public void loginByApi(String login) {
        signedInAs = login;
        SignedInRun.logIn(driver, TestData.webUrl(), login);
    }

    /** opens the app signed in with the run's API sign-in (the login of {@link #loginByApi}, else the test's own login) */
    public void loginProgrammatically() {
        String login = signedInAs != null ? signedInAs : Credentials.currentLogin();
        SignedInRun.open(driver, TestData.webUrl(), login);
    }

    /** the token of the run's sign-in as {@code login} - for the API set-up and clean-up ("Authorization: Bearer ...") */
    public static String tokenOf(String login) {
        return SignInToken.bearer(login);
    }
}
