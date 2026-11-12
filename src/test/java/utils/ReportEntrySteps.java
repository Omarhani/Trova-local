package utils;

import com.aventstack.extentreports.markuputils.ExtentColor;
import com.aventstack.extentreports.markuputils.MarkupHelper;
import org.testng.ITestContext;
import org.testng.ITestResult;
import org.testng.annotations.Parameters;

import java.io.File;
import java.lang.reflect.Method;
import java.util.List;

import static utils.MethodHandlesWeb.extent;
import static utils.MethodHandlesWeb.test;

/** The numbered entries of the report: open, close, status (split out of {@link UtilsTests}, reached through it). */
public class ReportEntrySteps extends WorkDateSteps {

    /** Numbers the test cases of the running report in run order; reset when a new report is made. */
    static int testCaseNumber;
    /**
     * File name of the running test case's screenshot, frames and GIF: {@code 3_verifyThat...}.
     * The number keeps them apart when a suite runs one method several times (a suite that
     * runs the same test method in seven blocks) - by method name alone, every
     * run overwrote the one before.
     */
    static String testCaseFileName = "test";

    public static String getTestCaseFileName() {
        return testCaseFileName;
    }

    /** Test or Stage, from the suite's server parameter - shown on the dashboard and in every entry. */
    static String reportEnv = "Test";

    /** Record types, shown as the entry's category (the report's Tags view filters by them). */
    public static final String API = "API", WEB = "Web", MOBILE = "Mobile";

    /**
     * Which test the open report entry belongs to (see {@link #entryKey}), null when none is open.
     * API, web and mobile entries share one report and one numbering, so an entry must be closed
     * before the next opens - otherwise the next test's steps land under the wrong number.
     */
    private static String openEntry;
    /** The open entry's result, noted by {@link ReportListener} for when its @AfterMethod never runs. */
    private static ITestResult openEntryResult;

    /** The same key from a @BeforeMethod (method + context + parameters) and from an ITestResult. */
    public static String entryKey(ITestContext context, Class<?> testClass, String methodName, Object[] parameters) {
        return (context == null ? "" : context.getName()) + "#" + testClass.getName() + "." + methodName
                + java.util.Arrays.deepToString(parameters == null ? new Object[0] : parameters);
    }

    static boolean isOpenFor(ITestResult result) {
        return openEntry != null && openEntry.equals(entryKey(result.getTestContext(),
                result.getMethod().getConstructorOrMethod().getDeclaringClass(), result.getMethod().getMethodName(), result.getParameters()));
    }

    static void noteResult(ITestResult result) {
        if (isOpenFor(result)) {
            openEntryResult = result;
        }
    }

    public void createTestCaseInReport(Method method) {
        createTestCaseInReport(method, null, new Object[0], WEB, null);
    }

    /**
     * Adds the test case to the report as "3. verifyThat...", with the suite xml's {@code <test name>}
     * underneath, its type (API / Web / Mobile) as the category, and a table of what ran: type, test
     * block, class and method, device, and the parameters this run got - from the xml, or the method's
     * {@code @Optional} default when the xml has none - so a method run several times with different
     * values can be told apart. An entry left open by the test before (its @AfterMethod never ran) is
     * closed first.
     */
    public void createTestCaseInReport(Method method, ITestContext context, Object[] parameters,
                                       String type, String device) {
        closeOpenEntry();
        openEntry(method.getDeclaringClass(), method.getName(), method.getAnnotation(Parameters.class),
                context, parameters, type, device);
        openEntry = entryKey(context, method.getDeclaringClass(), method.getName(), parameters);
    }

    /**
     * Opens a numbered entry; {@link #createTestCaseInReport} for a test that runs,
     * {@link ReportListener} for one TestNG skipped before its @BeforeMethod could open it.
     */
    static void openEntry(Class<?> testClass, String methodName, Parameters names, ITestContext context,
                          Object[] parameters, String type, String device) {
        int number = ++testCaseNumber;
        testCaseFileName = number + "_" + methodName;
        String xmlTestName = context != null ? context.getName() : null;
        LiveFeed.testStarted(number, methodName, xmlTestName, type);
        test = xmlTestName != null
                ? extent.createTest(number + ". " + methodName, xmlTestName)
                : extent.createTest(number + ". " + methodName);
        test.assignCategory(type);
        if (device != null) {
            test.assignDevice(device);
        }

        java.util.List<String[]> rows = new java.util.ArrayList<>();
        rows.add(new String[]{"<b>Type</b>", type});
        rows.add(new String[]{"<b>Env</b>", reportEnv});
        if (xmlTestName != null) {
            rows.add(new String[]{"<b>Test block</b>", xmlTestName});
        }
        rows.add(new String[]{"<b>Test</b>", testClass.getName() + "." + methodName});
        if (device != null) {
            rows.add(new String[]{"<b>Device</b>", device});
        }
        rows.add(new String[]{"<b>Started</b>", java.time.LocalTime.now().withNano(0).toString()});
        if (parameters != null) {
            for (int i = 0; i < parameters.length; i++) {
                String name = names != null && i < names.value().length ? names.value()[i] : "parameter " + (i + 1);
                rows.add(new String[]{name, String.valueOf(parameters[i])});
            }
        }
        test.info(MarkupHelper.createTable(rows.toArray(new String[0][])));
        test.info(MarkupHelper
                .createLabel("------------------- Steps To Reproduce -------------------", ExtentColor.TEAL));
    }

    public void endsOfSteps(){
        test.info(MarkupHelper
                .createLabel("------------------- Ends of Steps -------------------", ExtentColor.TEAL));
    }

    /**
     * Closes the running entry: the failure (message + stack trace) or skip reason, Ends of Steps,
     * pass / fail / skip. Afterwards nothing is logged until the next entry opens, so API calls made
     * between tests can't land in a finished one.
     */
    public void finishTestCase(ITestResult result) {
        if (test == null || openEntry == null) {
            return;
        }
        Throwable error = result.getThrowable();
        if (result.getStatus() == ITestResult.FAILURE && error != null) {
            test.fail(error);
        } else if (result.getStatus() == ITestResult.SKIP) {
            test.skip(MarkupHelper.createLabel("Skipped: " + skipReason(result), ExtentColor.ORANGE));
        }
        endsOfSteps();
        setStatus(result);
        LiveFeed.testFinished(result.getStatus() == ITestResult.SUCCESS ? "pass"
                        : result.getStatus() == ITestResult.FAILURE ? "fail" : "skip",
                error == null ? (result.getStatus() == ITestResult.SKIP ? skipReason(result) : "")
                        : String.valueOf(error).split("\n")[0]);
        openEntry = null;
        openEntryResult = null;
        test = null;
    }

    /** An entry still open when the next one starts or its test block ends: its @AfterMethod did not run. */
    static void closeOpenEntry() {
        if (openEntry == null || test == null) {
            openEntry = null;
            return;
        }
        if (openEntryResult != null) {
            new UtilsTests(null).finishTestCase(openEntryResult);
        } else {
            test.skip("Test did not finish - its clean-up step (@AfterMethod) did not run");
            LiveFeed.testFinished("skip", "did not finish - its clean-up step (@AfterMethod) did not run");
            openEntry = null;
            test = null;
        }
    }

    /** Why TestNG skipped it - its own reason, and the set-up step that failed before it, if any. */
    static String skipReason(ITestResult result) {
        StringBuilder reason = new StringBuilder();
        if (result.getThrowable() != null && result.getThrowable().getMessage() != null) {
            reason.append(result.getThrowable().getMessage());
        }
        for (ITestResult config : result.getTestContext().getFailedConfigurations().getAllResults()) {
            reason.append(reason.length() == 0 ? "" : " - ").append("set-up ")
                    .append(config.getMethod().getMethodName()).append(" failed");
            if (config.getThrowable() != null) {
                reason.append(": ").append(config.getThrowable().toString().split("\n")[0]);
            }
        }
        return reason.length() == 0 ? "no reason given by TestNG" : reason.toString();
    }

    public void setStatus(ITestResult result){
        if (result.getStatus() == ITestResult.SUCCESS){
            test.pass("Test Pass");
        } else if (result.getStatus() == ITestResult.FAILURE) {
            test.fail("Test Fail");
        } else if (result.getStatus() == ITestResult.SKIP) {
            test.skip("Test Skipped");
        }

    }
}
