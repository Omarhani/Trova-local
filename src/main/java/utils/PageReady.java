package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/**
 * Omar 2026-10-26 (session 58, run 40: "The Overtime switch did not show within 10 s" in 3 tests, all passed in run 41 -
 * the settings page was still loading): before a switch is set or a label / message is read, the page finishes loading -
 * the document is complete and no loading layer (Covers) is shown. Never fails: the read or action after it decides.
 */
public final class PageReady {

    /** how long a switch may take to show on a page that loads its settings */
    public static final int SWITCH_SECONDS = 20;
    private static final long STEP_MS = 150;

    private PageReady() {
    }

    /** waits up to {@code seconds} until the page has loaded and no loading layer covers it */
    public static void await(WebDriver driver, int seconds) {
        if (driver == null) return;
        long until = System.currentTimeMillis() + Math.max(1, seconds) * 1000L;
        WaitedReads.settled(driver, Math.max(1, until - System.currentTimeMillis()));
        while (Covers.shown(driver) && System.currentTimeMillis() < until) {
            try {
                Thread.sleep(STEP_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    /** Omar 2026-10-27: open a page (go = its menu click or its address from the framework's data), then wait for its section */
    public static void open(WebDriver driver, Runnable go, By section, int seconds, String name) {
        if (go != null) go.run();
        section(driver, section, seconds, name);
    }

    /** Omar 2026-10-27: the page loaded and its section (the part the test works on) shows - else fails in plain words */
    public static void section(WebDriver driver, By section, int seconds, String name) {
        await(driver, seconds);
        if (section != null && !WaitedReads.isShownWithin(driver, section, Math.max(1, seconds)))
            throw new AssertionError("The " + (name == null || name.isBlank() ? "page" : name) + " did not show within " + seconds + " s");
    }
}
