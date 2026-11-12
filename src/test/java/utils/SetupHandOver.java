package utils;

import org.testng.IInvokedMethod;
import org.testng.IInvokedMethodListener;
import org.testng.ITestResult;
import org.testng.SkipException;

import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Omar 2026-10-26 (session 48, runs 32 / 33: "An employee has a pending overtime request" passed though nothing made it):
 * a data set-up block ("Set up - &lt;the record&gt;") passes only when it handed a record to the tests - it kept a value
 * in {@link RunContext} or confirmed one with {@link NeedsRecord#made}. A set-up that passed and handed nothing is
 * skipped "Not tested - needs &lt;the record&gt;". Sign-in set-ups are not data set-ups.
 */
public class SetupHandOver implements IInvokedMethodListener {

    private static final Pattern SETUP = Pattern.compile("(?i)^\\s*set[ -]?up\\s*[-–:]\\s*(.+)$");
    private static final Pattern NOT_DATA = Pattern.compile("(?i)log[ -]?in|sign[ -]?in|token|programmatically");
    private static final Pattern SIGN_IN_KEY = Pattern.compile("(?i)token|signedin|signin|currentuser");
    private static final ThreadLocal<Map<String, Object>> BEFORE = new ThreadLocal<>();
    private static final ThreadLocal<Integer> HANDED = new ThreadLocal<>();
    /** Omar 2026-10-27 (run 243): a sign-in refused while this set-up ran - why */
    private static final ThreadLocal<String> REFUSED = new ThreadLocal<>();

    /**
     * Omar 2026-10-27 (run 243: the employee's sign-in was refused, no request made, the set-up still PASSED on an old
     * record): a data set-up during which a login's sign-in was refused is skipped "Not tested - &lt;reason&gt;", even when
     * its code caught the refusal and went on.
     */
    public static void signInRefused(String why) {
        if (REFUSED.get() == null) REFUSED.set(why);
    }

    @Override
    public void beforeInvocation(IInvokedMethod method, ITestResult result) {
        if (method.isTestMethod()) AppReason.clear(); // Omar 2026-10-27: only this test's refused calls
        if (!method.isTestMethod() || record(result) == null) return;
        BEFORE.set(RunContext.snapshot());
        HANDED.set(NeedsRecord.handed());
        REFUSED.remove();
    }

    @Override
    public void afterInvocation(IInvokedMethod method, ITestResult result) {
        if (!method.isTestMethod()) return;
        fillNullReason(result);
        Map<String, Object> before = BEFORE.get();
        Integer handed = HANDED.get();
        String refused = REFUSED.get();
        BEFORE.remove();
        HANDED.remove();
        REFUSED.remove();
        String record = record(result);
        if (record == null || before == null) return;
        if (refused != null) { // Omar 2026-10-27: a refused sign-in made nothing - never a pass on an older record
            skip(result, "Not tested - " + refused.replaceFirst("^Not tested - ", ""));
            return;
        }
        if (result.getStatus() != ITestResult.SUCCESS) { // Omar 2026-10-27: a set-up skipped / failed - the tests that need it skip
            Throwable t = result.getThrowable();
            String why = t instanceof SkipException && t.getMessage() != null && t.getMessage().startsWith("Not tested") ? t.getMessage() : null;
            RunContext.setupMadeNothing(why != null ? why : "Not tested - needs " + record);
            return;
        }
        if (handed != null && NeedsRecord.handed() > handed) return;
        if (keptSince(before)) return;
        skip(result, "Not tested - needs " + record);
    }

    /** Omar 2026-10-27 (try #257): a skip that says "HTTP 400 null" gets the app's own words */
    private static void fillNullReason(ITestResult result) {
        Throwable t = result.getThrowable();
        if (!(t instanceof SkipException) || t.getMessage() == null) return;
        String filled = AppReason.fill(t.getMessage());
        if (!filled.equals(t.getMessage())) result.setThrowable(new SkipException(filled));
    }

    private static void skip(ITestResult result, String why) {
        SkipException skip = new SkipException(why);
        result.setThrowable(skip);
        result.setStatus(ITestResult.SKIP);
        RunContext.setupMadeNothing(why);
        System.out.println("⏭ " + why + " - the set-up made or found nothing for the tests");
    }

    /** the record a data set-up block names, or null for any other block */
    static String record(ITestResult result) {
        String block = result.getTestContext() == null ? null : result.getTestContext().getName();
        Matcher m = SETUP.matcher(block == null ? "" : block);
        if (!m.find()) return null;
        String record = m.group(1).replaceAll("(?i)\\s*\\((api|ui|web|mobile|phone)\\)", "").replaceAll("[\\s\\-–]+$", "").trim();
        return record.isEmpty() || NOT_DATA.matcher(record).find() ? null : record;
    }

    /** a value the set-up kept for the tests (not the sign-in's own keys) */
    private static boolean keptSince(Map<String, Object> before) {
        return RunContext.snapshot().entrySet().stream().anyMatch(e -> !SIGN_IN_KEY.matcher(e.getKey()).find()
                && !Objects.equals(before.get(e.getKey()), e.getValue()));
    }
}
