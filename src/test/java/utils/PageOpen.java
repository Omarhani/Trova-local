package utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;

import java.time.Duration;
import java.util.List;

/**
 * Omar 2026-11-06 (run 209, case G3): the app's page was there in 760 ms, but the step waited the whole page-load
 * time (30 s) for a slow part of it, then loaded it all again (27 s more). A page open now waits at most
 * {@link #FIRST_WAIT} for the whole page; past that, as soon as the page itself is there (its content read, an app
 * address) the slow rest is stopped and the test goes on - its own checks still decide. A page that never comes within
 * the full page-load time fails as before and is never stopped half-way (the caller loads it once more). Run 901 case 557: the page counts as there only when fully loaded or its app-root has started - past "loading" the body held only the loader and an empty app, and stopping then cut off the app's own script. ("The browser was slow - retried once").
 */
public final class PageOpen {

    public static final Duration FIRST_WAIT = Duration.ofSeconds(10);
    private static final String LOOK = "return [document.readyState, location.href, !!(document.body && document.body.children.length), !!(document.querySelector('app-root') && document.querySelector('app-root').children.length)];";
    private static final long POLL_MS = 200;

    private PageOpen() {
    }

    public static void get(WebDriver driver, String url) {
        WebDriver.Timeouts timeouts = driver.manage().timeouts();
        Duration full = timeouts.getPageLoadTimeout();
        if (full == null) full = Duration.ofSeconds(30);
        long deadline = System.currentTimeMillis() + full.toMillis();
        timeouts.pageLoadTimeout(full.compareTo(FIRST_WAIT) > 0 ? FIRST_WAIT : full);
        try {
            driver.get(url);
        } catch (TimeoutException slow) {
            waitForThePage(driver, deadline, slow);
        } finally {
            timeouts.pageLoadTimeout(full);
        }
    }

    /** the page itself is there: its slow rest stops; still not there at the deadline: the slow answer as before */
    private static void waitForThePage(WebDriver driver, long deadline, TimeoutException slow) {
        while (true) {
            if (there(driver)) {
                try {
                    ((JavascriptExecutor) driver).executeScript("window.stop();");
                } catch (RuntimeException ignored) {
                    // the page is there; a stop that does not answer changes nothing
                }
                System.out.println("The page was there; a slow part of it was stopped so the test goes on");
                return;
            }
            if (System.currentTimeMillis() >= deadline) throw slow;
            try {
                Thread.sleep(POLL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw slow;
            }
        }
    }

    private static boolean there(WebDriver driver) {
        try {
            Object answer = ((JavascriptExecutor) driver).executeScript(LOOK);
            if (!(answer instanceof List<?> l) || l.size() < 4) return false;
            String state = String.valueOf(l.get(0)), href = String.valueOf(l.get(1));
            return !"loading".equals(state) && href.startsWith("http") && Boolean.TRUE.equals(l.get(2))
                    && ("complete".equals(state) || Boolean.TRUE.equals(l.get(3)));
        } catch (RuntimeException e) {
            return false; // the browser did not answer yet
        }
    }
}
