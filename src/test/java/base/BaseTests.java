package base;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import lombok.Getter;
import lombok.Setter;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.safari.SafariDriver;
import org.testng.IHookCallBack;
import org.testng.IHookable;
import org.testng.ITestContext;
import org.testng.ITestResult;
import org.testng.annotations.*;
import pages.*;
import screens.*;
import utils.BrowserGifRecorder;
import utils.LiveFeed;
import utils.MethodHandlesWeb;
import utils.MobileScreenRecorder;
import utils.MobileSession;
import utils.ReportListener;
import utils.RunContext;
import utils.TestTimeline;
import utils.UtilsTests;

import java.lang.reflect.Method;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.Duration;
import java.util.function.BooleanSupplier;


/**
 * Base of every web and mobile test class: starts the browser / phone, opens a numbered report entry per test,
 * records it (browser GIF + Timeline, phone recording), attaches the last screen, closes the entry with its result.
 *
 * <p>Which hooks run is chosen by the suite's groups: {@code Web} for browser tests, {@code Mob} for phone tests
 * ({@code <groups><run><include name="Mob"/></run></groups>}). The env comes from the suite's {@code server}
 * parameter and every address and the app package from Trova (Test Data → Environments, read with utils.TestData).
 * Your project's page objects and screens are created in {@link #setUpWeb} and {@link #setUp}.
 */
@Listeners({ReportListener.class, utils.SetupHandOver.class})
public class BaseTests implements IHookable {

    /// //////////////////////////////////////////////////////////////////////////////////////
    /// ////  Mobile Obj and Var
    /// //////////////////////////////////////////////////////////////////////////////////////
    URL url;
    protected AndroidDriver androidDriver;
    UiAutomator2Options options;

    @Getter
    @Setter
    public static String serverType;
    @Setter
    @Getter
    public static String baseURL;

    // Screen Objects - add your app's screens here
    public HomeScreen homeScreen;

    // Flag to prevent the @BeforeMethod from running before the first test
    private boolean isFirstTest = true;

    /// //////////////////////////////////////////////////////////////////////////////////////
    /// ////  Web Obj and Var
    /// //////////////////////////////////////////////////////////////////////////////////////


    /**
     * Rolled forward one day per test class instance ({@code data/testDate.txt}). Built on first use,
     * so only the suites that actually ask for it move the file.
     */
    private String testDate;
    protected WebDriver driver;

    /**
     * The day a scenario works on - for apps whose data is per day (bookings, timesheets, schedules) and refuse
     * the same action twice on one day. Four ways to ask for one, from a suite {@code <parameter>} - or from a
     * pipeline workDateFor&lt;Suite&gt; option, when the suite says e.g. {@code value="${workDateForMySuite}"}:
     *
     * <table>
     *   <tr><td>{@code "today"}</td>
     *       <td>the current date. Also what any unresolved {@code ${workDateFor...}} gives, i.e. a run
     *           started without that option.</td></tr>
     *   <tr><td>{@code "auto"}</td>
     *       <td>the run's own day, rolled forward one day per run ({@code data/workDate.txt}; the first run
     *           starts at {@code -DworkDateSeed} or today). Every {@code <test>} block of the run gets the same
     *           day, so a scenario can be spread over as many blocks as it needs and the next run
     *           moves to the next day on its own - nothing to edit between runs.</td></tr>
     *   <tr><td>{@code "auto:yyyy-MM-dd"}</td>
     *       <td>same as {@code auto}, but starting from that day and kept in its own file, e.g.
     *           {@code auto:1910-01-01} → {@code data/workDate-1910-01-01.txt}: 1910-01-01, then
     *           1910-01-02, ... one day per run.</td></tr>
     *   <tr><td>a date</td><td>that exact day, e.g. {@code 2026-07-17}, pinned.</td></tr>
     *   <tr><td>empty / absent</td>
     *       <td>the rolling {@code data/testDate.txt} value. <b>Careful:</b> that one is built once per test class
     *           instance, which TestNG makes once per {@code <test>} tag, so it moves a day per block.</td></tr>
     * </table>
     */
    protected String workDate(String workDate) {
        if (workDate == null || workDate.trim().isEmpty()) {
            if (testDate == null) {
                testDate = new UtilsTests(driver).getNextDynamicTestDate();
            }
            return testDate;
        }
        return WorkDays.of(workDate, driver);
    }

    // Page Objects - add your app's pages here
    public HomePage homePage;
    public LeavesPage leavesPage;
    public LoginPage loginPage;
    public RegistrationRequestsPage registrationRequestsPage;
    public OvertimeSettingsPage overtimeSettingsPage;
    public OvertimeRequestsPage overtimeRequestsPage;
    public WorkPlansPage workPlansPage;
    public InvoicesPage invoicesPage;

    protected String currentBrowser;

    protected UtilsTests utilsTests;

    /// //////////////////////////////////////////////////////////////////////////////////////
    /// ////  Web Methods
    /// //////////////////////////////////////////////////////////////////////////////////////
    @Parameters({"browser"})
    public void setUpBrowserWeb(String browser) {
        currentBrowser = browser;
        driver = OneBrowser.take(browser, () -> BrowserStart.open(browser)); // Omar 2026-11-06: one browser per run, cleaned per block
        if (driver instanceof SafariDriver) {
            driver.manage().window().setSize(new Dimension(BrowserStart.windowWidth(), BrowserStart.windowHeight()));
        }
    }


    @Parameters("browser")
    @BeforeClass(groups = "Web")
    public void setUpWeb(@Optional("Chrome") String browser) {
        utilsTests = new UtilsTests(driver);
        setUpBrowserWeb(browser);
        driver.manage().window().setSize(new Dimension(BrowserStart.windowWidth(), BrowserStart.windowHeight()));
        LiveFeed.browser(driver); // the platform's live screen
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        // your project's page objects
        homePage = new HomePage(driver);
        leavesPage = new LeavesPage(driver);
        loginPage = new LoginPage(driver);
        registrationRequestsPage = new RegistrationRequestsPage(driver);
        overtimeSettingsPage = new OvertimeSettingsPage(driver);
        overtimeRequestsPage = new OvertimeRequestsPage(driver);
        workPlansPage = new WorkPlansPage(driver);
        invoicesPage = new InvoicesPage(driver);
    }

    @AfterMethod(groups = "Web")
    public void afterMethodWeb(Method method, ITestResult result) {
        utilsTests = new UtilsTests(driver);
        try {
            BrowserGifRecorder.stopRecord();
            TestTimeline.stop();
            // a hung browser can't give its last screen, but the recording up to that point still goes in
            utilsTests.saveLastScreenOrExplain(method);
            utilsTests.addTimeline(result);
            utilsTests.addAttachment(method);
        } catch (Exception e) {
            // a dead browser must not leave the entry without its result
            System.out.println("Could not save the attachments: " + e.getMessage());
        } finally {
            utilsTests.finishTestCase(result);
        }
    }

    @AfterClass(groups = "Web")
    public void tearDownWeb() {
        if (driver != null && !OneBrowser.keep(driver)) { // a kept browser closes at the run's end
            LiveFeed.browserClosing();
            // with -DattachBrowser this ends only the ChromeDriver session: the attached Chrome stays open on its page
            driver.quit();
        }
    }

    @BeforeMethod(groups = "Web")
    public void goHomeWeb(Method method, ITestContext context, Object[] parameters) throws Exception {
        utilsTests = new UtilsTests(driver);
        // numbered entry with the xml <test> name and parameters; also names this run's files
        utilsTests.createTestCaseInReport(method, context, parameters, UtilsTests.WEB,
                currentBrowser == null || currentBrowser.startsWith("${") ? "Chrome" : currentBrowser);
        // records the browser only, so it works headless and on Jenkins too
        BrowserGifRecorder.startRecord(driver, UtilsTests.getTestCaseFileName());
        // steps with their locators + the browser's API calls, for the entry's Timeline tab
        TestTimeline.start(driver);
        // Trova DEF-384: <parameter name="signedInAs" value="Admin"/> on the xml test = the app opens already signed in
        // (the session from the API login - utils.SignedInBrowser), no login page: in a Hybrid suite the login is never a test
        String signedInAs = context.getCurrentXmlTest().getParameter("signedInAs");
        // Omar 2026-10-25: the state of the run's one sign-in (Log in programmatically) - a test never signs in again
        if (signedInAs != null && !signedInAs.isBlank() && !signedInAs.startsWith("${")) {
            utils.SignedInRun.open(driver, getBaseURL(), signedInAs);
        } else {
            BrowserStart.openWithOneRetry(driver, getBaseURL());
        }
    }

    /** Omar 2026-10-25: the run's one programmatic sign-in - call it in logInProgrammatically; fails with the app's reason */
    protected void signInOnce(String login) {
        utils.SignedInRun.logIn(driver, getBaseURL(), login);
    }

    /** Omar 2026-10-25: Log in programmatically passes only when the app really opens signed in (utils.SignedInRun) */
    @Override
    public void run(IHookCallBack callBack, ITestResult result) {
        callBack.runTestMethod(result);
        utils.SignedInRun.afterLogInBlock(driver, getBaseURL(), result);
    }

    @Parameters({"server"})
    @BeforeSuite(groups = "Web")
    public void beforeSuiteWeb(@Optional("Test") String server, ITestContext context) {
        // report/testEnv|stageEnv/<suite xml name>/<suite xml name>.html + this suite's png/gif
        UtilsTests.setReportFolder(context.getSuite(), server);
        setEnv(server);
        MethodHandlesWeb.setURL(getBaseURL());
        utilsTests = new UtilsTests(driver);
        utilsTests.createReport();
        RunContext.clear();
        utils.SignedInRun.clear(); // Omar 2026-10-25: a new suite signs in once again

        // the work day is picked on the first workDate="auto" of this run, not here
        WorkDays.reset();
    }

    @AfterSuite(groups = "Web")
    public void afterSuiteWeb() {
        utilsTests = new UtilsTests(driver);
        utilsTests.flushReport();
        LiveFeed.browserClosing();
        OneBrowser.close();
    }

    /** Omar 2026-10-25: false = this suite is web only - no Appium start / stop */
    private static boolean phoneSuite = true;

    // Start Appium server before Mob suite
    @Parameters({"server"})
    @BeforeSuite(groups = "Mob")
    public void beforeSuiteMob(@Optional("Test") String server, ITestContext context) {
        // Omar 2026-10-25: a web suite (its blocks name groups, none Mob) never starts the phone set-up
        phoneSuite = utils.SuiteGroups.usesPhone(context.getSuite().getXmlSuite());
        if (!phoneSuite) return;
        // same report folder and html as the web suites (a hybrid suite shares one report)
        UtilsTests.setReportFolder(context.getSuite(), server);
        new UtilsTests(androidDriver).createReport();

        setEnv(server);
        RunContext.clear();
        startServer();
    }

    // Stop Appium server after Mob suite
    @AfterSuite(groups = "Mob")
    public void afterSuiteMob() {
        if (!phoneSuite) return;
        new UtilsTests(androidDriver).flushReport();
        stopServer();
    }

    /// //////////////////////////////////////////////////////////////////////////////////////
    /// ////  Mob Methods
    /// //////////////////////////////////////////////////////////////////////////////////////

    /** The app under test on the phone - Trova → Test Data → Environments → Mobile app. */
    protected static utils.TestData.Mobile mobile() {
        return utils.TestData.mobile();
    }

    /**
     * The phone's loginProgrammatically: the first call for a user runs {@code uiLogin} (your app's login
     * screens) and, once {@code loggedIn} says the app is past login, saves the app's login file
     * ({@link MobileSession}, needs -DmobileSessionFile); every later call - a new {@code <test>} block, whose
     * session starts with the app's data cleared - writes it back and the app opens logged in. If the saved
     * login does not get past login, it is dropped and the UI login runs again.
     */
    protected void loginOnPhone(String userName, Runnable uiLogin, BooleanSupplier loggedIn) {
        RunContext.setCurrentUser(userName);
        String key = sessionKey(userName);
        if (MobileSession.restore(androidDriver, key)) {
            if (loggedIn.getAsBoolean()) {
                return;
            }
            MobileSession.forget(androidDriver, key);
        }

        // the session starts without the app when a saved login exists; a UI login still needs it on screen
        MobileSession.launchIfClosed(androidDriver, mobile().appPackage());
        uiLogin.run();
        if (loggedIn.getAsBoolean()) {
            MobileSession.save(androidDriver, key);
        }
    }

    /** The saved-login key: one per server and user, as a run may make its own user. */
    private String sessionKey(String userName) {
        return getServerType() + "|" + userName;
    }

    public UiAutomator2Options setUpDeviceAndTheAppApplication() {
        utils.TestData.Mobile mobile = mobile();
        options = PhoneOptions.forRun(mobile, RunContext.currentUser() == null ? null : sessionKey(RunContext.currentUser()));
        return options;
    }

    @BeforeMethod(groups = "Mob")
    public void goHome(Method method, ITestContext context, Object[] parameters) {
        // the entry first: if the app restart below fails, the skip is reported under this test, not the one before
        utilsTests = new UtilsTests(androidDriver);
        utilsTests.createTestCaseInReport(method, context, parameters, UtilsTests.MOBILE, "Android");
        MobileSession.newTest();
        String app = mobile().appPackage();
        if (isFirstTest) {
            isFirstTest = false;
        } else {
            androidDriver.terminateApp(app);
            // Same rule as the session start (setUpDeviceAndTheAppApplication): with a saved login for the
            // run's user, loginOnPhone starts the app itself. Only a block with several tests gets here.
            if (!MobileSession.hasSaved(sessionKey(RunContext.currentUser()))) {
                androidDriver.activateApp(app);
            }
        }
        MobileScreenRecorder.startRecord(androidDriver, UtilsTests.getTestCaseFileName());
    }

    @AfterMethod(groups = "Mob")
    public void afterMethodMob(Method method, ITestResult result) {
        utilsTests = new UtilsTests(androidDriver);
        // the app refreshed its tokens during the test: the next block needs this copy, not the one from login
        MobileSession.saveAgain(androidDriver);
        try {
            MobileScreenRecorder.stopRecord();
            utilsTests.saveLastScreenOrExplain(method);
            utilsTests.addAttachment(method, true);
        } catch (Exception e) {
            // a lost phone session must not leave the entry without its result
            System.out.println("Could not save the attachments: " + e.getMessage());
        } finally {
            utilsTests.finishTestCase(result);
        }
    }

    @BeforeClass(groups = "Mob")
    public void setUp() throws MalformedURLException {
        url = new URL("http://127.0.0.1:4723/");
        UiAutomator2Options baseOptions = setUpDeviceAndTheAppApplication();

        try {
            androidDriver = new AndroidDriver(url, baseOptions);
            System.out.println("App started via package/activity (app assumed installed on device).");
        } catch (Exception e) {
            String apk = mobile().appFilePath();
            if (apk.isEmpty() || !new java.io.File(apk).isFile()) {
                throw new IllegalStateException("The app did not start (" + String.valueOf(e.getMessage()).split("\n")[0]
                        + ") and there is no app file to install: add it in Trova → Test Data → Environments → Mobile app (now \"" + apk + "\")", e);
            }
            System.out.println("Failed to start app via package/activity, attempting to install APK: " + e.getMessage());
            baseOptions.setApp(apk);
            baseOptions.setEnforceAppInstall(true);
            androidDriver = new AndroidDriver(url, baseOptions);
            System.out.println("APK installed and app started.");
        }

        // your project's screens
        homeScreen = new HomeScreen(androidDriver);
    }

    @AfterClass(groups = "Mob")
    public void tearDown() {
        if (androidDriver != null) {
            PhoneOptions.giveTheKeyboardBack(androidDriver);
            androidDriver.quit();
        }
    }

    public static void startServer() {
        AppiumServer.start();
    }

    public static void stopServer() {
        AppiumServer.stop();
    }

    /**
     * The env of the run - a key of ENVIRONMENTS in the data file; {@code ${serverType}} (no -DserverType)
     * means Test. Sets the web URL every web test opens, and the hosts the API clients call.
     */
    @Parameters("server")
    public void setEnv(@Optional("Test") String server) {
        setServerType(utils.TestData.setEnv(server));
        setBaseURL(utils.TestData.webUrl());
    }

}
