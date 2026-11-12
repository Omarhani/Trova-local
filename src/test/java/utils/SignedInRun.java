package utils;

import com.google.gson.JsonObject;
import org.openqa.selenium.WebDriver;
import org.testng.ITestResult;
import org.testng.xml.XmlTest;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Omar 2026-10-25 - the run's ONE programmatic sign-in, and every test block after it.
 * <ul>
 *   <li>{@link #logIn}: "Log in programmatically" - passes only when the app really opens signed in (the kept sign-in,
 *   the API sign-in or one screen sign-in, then the signed-in page checked); else it FAILS with the app's reason.</li>
 *   <li>{@link #open}: a test block - the state that sign-in made (cookies, local and session storage: THEME, LANGUAGE,
 *   the Test Data browser storage ...) goes back in. A test never signs in again; only a quiet refresh (API / the app's
 *   refresh call) when the token runs out. A refused sign-in stops every block with that reason at once.</li>
 * </ul>
 * No "Log in programmatically" block in the run (one test, an AI run's try): the first block makes the one sign-in.
 */
public final class SignedInRun {

    /** login → why the run's sign-in did not get through */
    private static final Map<String, String> REFUSED = new ConcurrentHashMap<>();
    private static final Set<String> DONE = ConcurrentHashMap.newKeySet();

    private SignedInRun() {
    }

    /** the run's one sign-in as {@code login}; throws with the app's reason when the app does not open signed in */
    public static void logIn(WebDriver driver, String url, String login) {
        String k = key(login);
        if (REFUSED.containsKey(k)) throw new IllegalStateException(REFUSED.get(k));
        if (DONE.contains(k)) { // Omar 2026-10-25: signed in already this run - its state goes in, no second sign-in
            // the block's own open already loaded the app signed in: no second load of the same page, only the check
            if (SignInPage.signedIn(driver, doneSign(login), startOf(login)) == null) return;
            SignedInBrowser.reuse(driver, url, login);
            return;
        }
        try {
            BrowserSlow.retryOnce(() -> { // Omar 2026-10-25: a slow browser is tried once more, never a refused sign-in
                SignedInBrowser.first(driver, url, login);
                String why = notSignedIn(driver, login);
                if (why != null) {
                    throw new IllegalStateException(ScreenSignIn.appName(url) + " did not open signed in as \"" + login + "\": " + why);
                }
            });
        } catch (RuntimeException e) {
            if (BrowserSlow.is(e)) throw new IllegalStateException(BrowserSlow.SLOW + " - retried once, the app did not open in time", e);
            String reason = plain(e.getMessage() == null || e.getMessage().isBlank()
                    ? "The sign-in did not get through - try again" : e.getMessage()); // Omar 2026-10-26: never blames the login
            REFUSED.put(k, reason);
            RunContext.put("signInRefused", true);
            RunContext.put("signInRefusedWhy", reason);
            throw new IllegalStateException(reason, e);
        }
        DONE.add(k);
        RunContext.put("signedInAs", login);
        System.out.println("Signed in as " + login + " - every test of this run uses this sign-in");
    }

    /** a test block opens {@code url} signed in as {@code login} with the state of the run's one sign-in */
    public static void open(WebDriver driver, String url, String login) {
        String k = key(login);
        String refused = REFUSED.get(k);
        if (refused != null) throw new IllegalStateException(refused); // Omar 2026-10-25: the one reason, at once, no new try
        if (DONE.contains(k)) {
            try {
                BrowserSlow.retryOnce(() -> SignedInBrowser.reuse(driver, url, login)); // Omar 2026-10-25: slow browser = one more try
            } catch (RuntimeException e) { // Omar 2026-10-25: no usable state - this and every later block stop with one reason
                if (BrowserSlow.is(e)) throw new IllegalStateException(BrowserSlow.SLOW + " - retried once, the app did not open in time", e);
                String reason = plain(e.getMessage() == null ? "the sign-in made before the tests no longer opens the app" : e.getMessage());
                REFUSED.put(k, reason);
                RunContext.put("signInRefused", true);
                RunContext.put("signInRefusedWhy", reason);
                throw new IllegalStateException(reason, e);
            }
            return;
        }
        logIn(driver, url, login);
    }

    /**
     * After a "Log in programmatically" block passed: a block that only looked the login up (no real sign-in) is checked
     * here with the real one, and fails with the app's reason when it is refused - never a false pass.
     */
    public static void afterLogInBlock(WebDriver driver, String url, ITestResult result) {
        if (result.getThrowable() != null || driver == null || !"logInProgrammatically".equals(result.getMethod().getMethodName())) return;
        String login = loginOf(result);
        if (login == null || signedIn(login)) return;
        try {
            logIn(driver, url, login);
        } catch (RuntimeException refused) {
            result.setThrowable(refused);
            result.setStatus(ITestResult.FAILURE);
            throw refused;
        }
    }

    /** a block without a sign-in: the app opens with Test Data → Browser storage already in */
    public static void openPlain(WebDriver driver, String url) {
        if (signInBlockNext()) { // Omar 2026-10-27: the app loaded twice - the sign-in block's sign-in opens it once
            driver.get("about:blank");
            return;
        }
        if (StorageModes.any()) StorageModes.open(driver, url); else PageOpen.get(driver, url); // Omar 2026-11-06: no 30 s wait on a slow part
    }

    /** the block about to run is "Log in programmatically" and nobody is signed in yet */
    private static boolean signInBlockNext() {
        org.testng.ITestResult now = org.testng.Reporter.getCurrentTestResult();
        String block = now == null || now.getTestContext() == null ? "" : now.getTestContext().getName();
        return block != null && block.matches("(?i).*log\\s*-?\\s*in\\s+programmatically.*") && DONE.isEmpty() && REFUSED.isEmpty();
    }

    /** the run already signed in as {@code login} */
    public static boolean signedIn(String login) {
        return DONE.contains(key(login));
    }

    /**
     * The login a "Log in programmatically" block signs in as: what the test kept ({@code RunContext "signedInAs"}), its
     * block's {@code signedInAs}, else the first block of the suite that has one; null when no block signs in.
     */
    public static String loginOf(ITestResult result) {
        if (RunContext.has("signedInAs") && RunContext.get("signedInAs") instanceof String s && usable(s)) return s.trim();
        String own = result.getTestContext().getCurrentXmlTest().getParameter("signedInAs");
        if (usable(own)) return own.trim();
        for (XmlTest t : result.getTestContext().getSuite().getXmlSuite().getTests()) {
            String v = t.getParameter("signedInAs");
            if (usable(v)) return v.trim();
        }
        return null;
    }

    /** a new suite: nothing signed in yet */
    public static void clear() {
        REFUSED.clear();
        DONE.clear();
    }

    private static String doneSign(String login) {
        JsonObject recipe = KeptSignIn.recipe(login);
        return recipe != null && recipe.has("done") ? recipe.get("done").getAsString() : null;
    }

    private static String startOf(String login) {
        JsonObject recipe = KeptSignIn.recipe(login);
        return recipe != null && recipe.has("url") ? recipe.get("url").getAsString() : null;
    }

    /** null when the page shows the app signed in (the login's done sign or the signed-in shell), else why not */
    private static String notSignedIn(WebDriver driver, String login) {
        JsonObject recipe = KeptSignIn.recipe(login);
        String done = recipe != null && recipe.has("done") ? recipe.get("done").getAsString() : null;
        String start = recipe != null && recipe.has("url") ? recipe.get("url").getAsString() : null;
        String why = SignInPage.signedIn(driver, done, start);
        for (int i = 0; why != null && i < 10; i++) { // a slow first page: up to 5 s more
            sleep(500);
            why = SignInPage.signedIn(driver, done, start);
        }
        return why;
    }

    /** Omar 2026-10-25: "Sign-in did not work: <reason>" - one plain line (first line only, never a stack) */
    static String plain(String reason) {
        String one = reason.strip().split("\\R", 2)[0].strip();
        return one.startsWith(PREFIX) ? one : PREFIX + one;
    }

    static final String PREFIX = "Sign-in did not work: ";

    /** the reason the run's sign-in did not work (null = it worked or was not tried) - a test / the clean-up stops with it */
    public static String refused(String login) {
        return REFUSED.get(key(login));
    }

    private static boolean usable(String v) {
        return v != null && !v.isBlank() && !v.startsWith("${");
    }

    private static String key(String login) {
        return String.valueOf(login).trim().toLowerCase();
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
