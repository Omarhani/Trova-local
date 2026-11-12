package utils;

import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebDriverException;

/**
 * Trova TICKET-980 (Omar 2026-10-23) - a step that finds the app signed out in the middle of a test (sent back to the
 * sign-in page, a password / code box shows, the app's calls answer "token expired") signs in again and is tried once
 * more: sign-ins can live 5 minutes (banking). Only a step that failed is checked, only once, never in a loop: a second
 * sign-out within a minute stops the test with plain words. The test side sets the {@link Watcher} (utils.MidRunSignIn,
 * for tests opened signed in); without one a step fails as it always did.
 */
public final class SignedOutStep {

    /** the test side: is the app signed out now, and sign in again (back on {@code at}); throws with plain words when refused */
    public interface Watcher {
        boolean signedOut(WebDriver driver);

        void signInAgain(WebDriver driver, String at);
    }

    private static final long AGAIN_TOO_SOON_MS = 60_000;
    private static volatile WebDriver watched;
    private static volatile Watcher watcher;
    private static volatile long lastRefresh;

    private SignedOutStep() {
    }

    /** watch this browser (null = stop watching) */
    public static void watch(WebDriver driver, Watcher w) {
        watched = driver;
        watcher = w;
    }

    /** runs one step's wait; when it fails and the app is signed out, signs in again and runs it once more */
    public static void once(WebDriver driver, Runnable step) {
        Watcher w = watcher;
        if (w == null || driver != watched) {
            act(driver, step);
            return;
        }
        String at = safeUrl(driver);
        try {
            step.run();
        } catch (WebDriverException failed) {
            if (!StuckStep.stuck(failed)) throw failed;
            if (!(failed instanceof TimeoutException) || !w.signedOut(driver)) {
                StuckStep.help(driver, failed, step); // Omar 2026-10-25: not signed out - stuck on something else
                return;
            }
            if (System.currentTimeMillis() - lastRefresh < AGAIN_TOO_SOON_MS) {
                throw new IllegalStateException("The app signed out again right after Trova signed in again - the step is not tried a third time", failed);
            }
            lastRefresh = System.currentTimeMillis();
            System.out.println("The app signed out in the middle of the test - signing in again and trying the step once more");
            w.signInAgain(driver, at);
            step.run();
        }
    }

    /**
     * Omar 2026-10-25: one step's action (a click, typing) - stuck on a time-out, a stale element, an element not
     * clickable or a covered click = AI help, then the step once more; any other failure as it is.
     */
    public static void act(WebDriver driver, Runnable step) {
        try {
            step.run();
        } catch (WebDriverException failed) {
            if (!StuckStep.stuck(failed)) throw failed;
            StuckStep.help(driver, failed, step);
        }
    }

    private static String safeUrl(WebDriver driver) {
        try {
            return driver.getCurrentUrl();
        } catch (Exception e) {
            return null;
        }
    }
}
