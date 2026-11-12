package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;
import java.util.function.Function;

/**
 * TICKET-983 (Omar 2026-10-23, run 122 "Add employee"): reads for assertions that WAIT for the expected state instead of
 * reading once. A list read with findElements().size() right after Save gave 0 before the list refreshed.
 * Every method polls (WebDriverWait, 500 ms) until the state is reached or the time is up and then returns what it saw
 * last - so the assertion still reports the real value. Web (WebDriver) and phone (AndroidDriver) alike; no Thread.sleep.
 * Pages use them through MethodHandlesWeb / BaseScreen: countBecomes, isShownWithin, isGoneWithin ...
 */
public final class WaitedReads {

    public static final int DEFAULT_SECONDS = 15;
    private static final Duration POLL = Duration.ofMillis(500);

    private WaitedReads() {
    }

    /** waits until {@code locator} matches {@code expected} elements; the last count seen (the real one on time-out) */
    public static int countBecomes(WebDriver driver, By locator, int expected, int seconds) {
        int[] last = {-1};
        poll(driver, seconds, d -> {
            last[0] = d.findElements(locator).size();
            return last[0] == expected;
        });
        return last[0] < 0 ? driver.findElements(locator).size() : last[0];
    }

    /**
     * Omar 2026-10-25: after a save or a search the list refreshes late - waits for the loading layers to go and then until
     * at least one row of {@code locator} shows (at most {@code seconds}); the last count seen (0 only when none came).
     */
    public static int rowsShownWithin(WebDriver driver, By locator, int seconds) {
        Covers.waitGone(driver);
        int[] last = {0};
        poll(driver, seconds, d -> {
            last[0] = d.findElements(locator).size();
            return last[0] > 0;
        });
        return last[0];
    }

    /**
     * The count once the list has settled: the same count on 3 polls in a row (1.5 s), at most {@code seconds}.
     * For a "before" count and for "nothing shows" (0 rows) checks - never a count read once while the list loads.
     */
    public static int settledCount(WebDriver driver, By locator, int seconds) {
        int[] state = {-1, 0}; // last count, polls it stayed the same
        poll(driver, seconds, d -> {
            int now = d.findElements(locator).size();
            state[1] = now == state[0] ? state[1] + 1 : 0;
            state[0] = now;
            return state[1] >= 3;
        });
        return state[0];
    }

    /** true as soon as an element of {@code locator} is visible; false when none shows within {@code seconds} */
    public static boolean isShownWithin(WebDriver driver, By locator, int seconds) {
        return poll(driver, seconds, d -> ExpectedConditions.visibilityOfElementLocated(locator).apply(d) != null);
    }

    /** true as soon as {@code locator} is gone or hidden ("already gone" counts); false when it still shows */
    public static boolean isGoneWithin(WebDriver driver, By locator, int seconds) {
        return poll(driver, seconds, d -> ExpectedConditions.invisibilityOfElementLocated(locator).apply(d));
    }

    /** true as soon as a visible element of {@code locator} is enabled (no disabled / aria-disabled) */
    public static boolean isEnabledWithin(WebDriver driver, By locator, int seconds) {
        return poll(driver, seconds, d -> d.findElements(locator).stream().anyMatch(e -> e.isDisplayed() && enabled(e)));
    }

    /** true as soon as every visible element of {@code locator} is disabled (one must show) */
    public static boolean isDisabledWithin(WebDriver driver, By locator, int seconds) {
        return poll(driver, seconds, d -> {
            List<WebElement> shown = d.findElements(locator).stream().filter(WebElement::isDisplayed).toList();
            return !shown.isEmpty() && shown.stream().noneMatch(WaitedReads::enabled);
        });
    }

    /**
     * Waits until the element's MESSAGE (UiText.visibleMessage: no close button "×", spaces made single) equals
     * {@code expected} (cleaned the same way); the last message seen - "" when it never showed.
     */
    public static String textBecomes(WebDriver driver, By locator, String expected, int seconds) {
        String want = UiText.withoutClose(expected);
        String[] last = {""};
        poll(driver, seconds, d -> {
            List<WebElement> found = d.findElements(locator);
            if (found.isEmpty()) return false;
            last[0] = UiText.visibleMessage(found.get(0));
            return last[0].equals(want);
        });
        return last[0];
    }

    /** the element's MESSAGE once it is visible and has text (close button left out); "" when none shows */
    public static String messageOf(WebDriver driver, By locator, int seconds) {
        String[] last = {""};
        poll(driver, seconds, d -> {
            List<WebElement> found = d.findElements(locator);
            if (found.isEmpty() || !found.get(0).isDisplayed()) return false;
            last[0] = UiText.visibleMessage(found.get(0));
            return !last[0].isEmpty();
        });
        return last[0];
    }

    /** waits until the field's value equals {@code expected} (typing applied); the last value seen */
    public static String valueBecomes(WebDriver driver, By locator, String expected, int seconds) {
        String[] last = {""};
        poll(driver, seconds, d -> {
            List<WebElement> found = d.findElements(locator);
            if (found.isEmpty()) return false;
            String v = found.get(0).getAttribute("value");
            last[0] = v == null ? "" : v;
            return last[0].equals(expected);
        });
        return last[0];
    }

    /**
     * the first answer of {@code read} that is not null / false within {@code millis} (asked every {@code pollMillis});
     * null when the time is up - for checks that have no locator (a script finder, "signed in yet?")
     */
    public static <T> T within(WebDriver driver, long millis, long pollMillis, Function<WebDriver, T> read) {
        try {
            return new WebDriverWait(driver, Duration.ofMillis(Math.max(1, millis)), Duration.ofMillis(Math.max(50, pollMillis)))
                    .ignoring(StaleElementReferenceException.class)
                    .ignoring(NoSuchElementException.class)
                    .until(read::apply);
        } catch (TimeoutException late) {
            return null;
        }
    }

    /** waits up to {@code millis} until the page has loaded (document.readyState complete); false on time-out */
    public static boolean settled(WebDriver driver, long millis) {
        return within(driver, millis, 100, d -> "complete".equals(((org.openqa.selenium.JavascriptExecutor) d)
                .executeScript("return document.readyState"))) != null;
    }

    /** clicks an element found without a locator once it is shown and enabled (up to {@code seconds}), then lets the page settle */
    public static void clickWhenReady(WebDriver driver, WebElement element, int seconds) {
        within(driver, seconds * 1000L, 200, d -> element.isDisplayed() && enabled(element));
        element.click(); // wait-ok: waited for shown + enabled just above
        settled(driver, 2000);
    }

    /** types into an element found without a locator once it is shown and enabled (up to {@code seconds}) */
    public static void typeWhenReady(WebDriver driver, WebElement element, int seconds, CharSequence... keys) {
        within(driver, seconds * 1000L, 200, d -> element.isDisplayed() && enabled(element));
        element.sendKeys(keys); // wait-ok: waited for shown + enabled just above
    }

    private static boolean enabled(WebElement e) {
        String aria = e.getAttribute("aria-disabled");
        return e.isEnabled() && !"true".equalsIgnoreCase(aria);
    }

    /** true when {@code condition} came true within {@code seconds}; a stale / missing element just polls again */
    private static boolean poll(WebDriver driver, int seconds, Function<WebDriver, Boolean> condition) {
        try {
            new WebDriverWait(driver, Duration.ofSeconds(Math.max(1, seconds)), POLL)
                    .ignoring(StaleElementReferenceException.class)
                    .ignoring(NoSuchElementException.class)
                    .until(d -> Boolean.TRUE.equals(condition.apply(d)) ? Boolean.TRUE : null);
            return true;
        } catch (TimeoutException late) {
            return false;
        }
    }
}
