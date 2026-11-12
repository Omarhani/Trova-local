package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.Locale;

/**
 * Omar 2026-10-26 (session 48, case "monthly balance field shows when overtime is on"): a switch or checkbox is SET to the
 * wanted state - read first, click only when it differs, then wait until it shows that state. A blind click turned
 * Overtime OFF because an earlier run had left it ON. Reads a native checkbox, aria-checked / aria-pressed, an inner
 * input, or an "on / checked / active" class.
 */
public final class Switches {

    private Switches() {
    }

    /** sets the switch / checkbox at {@code locator} to {@code on}; returns true when it had to click */
    public static boolean set(WebDriver driver, By locator, boolean on, int seconds) {
        return set(driver, locator, on, seconds, null);
    }

    /** the same, with the switch's name for a plain failure ("The Overtime switch did not turn on within 10 s") */
    public static boolean set(WebDriver driver, By locator, boolean on, int seconds, String name) {
        int s = Math.max(1, seconds);
        int find = Math.max(s, PageReady.SWITCH_SECONDS); // Omar 2026-10-26: a settings page may load slowly - up to 20 s to show
        String what = name == null || name.isBlank() ? "The switch" : "The " + name.strip() + " switch";
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(s));
        PageReady.await(driver, find); // Omar 2026-10-26: the page / section finishes loading first
        WebElement el;
        try {
            el = new WebDriverWait(driver, Duration.ofSeconds(find)).ignoring(org.openqa.selenium.StaleElementReferenceException.class)
                    .until(d -> d.findElements(locator).stream().filter(WebElement::isDisplayed).findFirst().orElse(null));
        } catch (TimeoutException late) { // Omar 2026-10-26: plain words, never the wait's inner name
            throw new TimeoutException(what + " was not on the screen within " + find + " s - the page did not finish loading");
        }
        Covers.waitGone(driver);
        el = steady(driver, locator, el); // Omar 2026-10-26: its saved state may arrive just after it shows
        if (isOn(driver, el) == on) return false;
        Covers.waitGone(driver);
        try {
            el.click();
        } catch (RuntimeException covered) { // a styled switch hides its input: click it the way the page does
            ((JavascriptExecutor) driver).executeScript("arguments[0].click();", el);
        }
        try {
            wait.until(d -> isOn(d, d.findElement(locator)) == on);
        } catch (TimeoutException late) { // Omar 2026-10-26: plain words, never the wait's inner name
            throw new TimeoutException(what + " did not turn " + (on ? "on" : "off") + " within " + s + " s");
        }
        return true;
    }

    /** the switch once its state stops changing (two reads 400 ms apart agree, at most 2 s) */
    private static WebElement steady(WebDriver driver, By locator, WebElement el) {
        long until = System.currentTimeMillis() + 2000;
        try {
            boolean before = isOn(driver, el);
            while (System.currentTimeMillis() < until) {
                Thread.sleep(400);
                el = driver.findElement(locator);
                boolean now = isOn(driver, el);
                if (now == before) return el;
                before = now;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException changing) { // re-drawn while read: the click below finds it again
            return driver.findElements(locator).stream().findFirst().orElse(el);
        }
        return el;
    }

    /** the switch's state now */
    public static boolean isOn(WebDriver driver, By locator) {
        return isOn(driver, driver.findElement(locator));
    }

    static boolean isOn(WebDriver driver, WebElement el) {
        String aria = first(el.getAttribute("aria-checked"), el.getAttribute("aria-pressed"));
        if (aria != null) return "true".equalsIgnoreCase(aria);
        String tag = el.getTagName().toLowerCase(Locale.ROOT);
        if ("input".equals(tag)) return el.isSelected();
        Object inner = ((JavascriptExecutor) driver).executeScript(
                "var i = arguments[0].querySelector('input[type=checkbox],input[type=radio],[role=switch],[role=checkbox]');"
                        + "if (!i) return null; if (i.tagName === 'INPUT') return i.checked;"
                        + "return (i.getAttribute('aria-checked') || '') === 'true';", el);
        if (inner instanceof Boolean b) return b;
        String cls = " " + String.valueOf(el.getAttribute("class")).toLowerCase(Locale.ROOT) + " ";
        return cls.matches(".*[\\s_-](on|checked|active|is-checked|ant-switch-checked|mat-checked|mdc-switch--selected)[\\s_-].*");
    }

    private static String first(String a, String b) {
        return a != null && !a.isBlank() ? a : b != null && !b.isBlank() ? b : null;
    }
}
