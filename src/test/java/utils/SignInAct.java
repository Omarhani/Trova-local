package utils;

import org.openqa.selenium.ElementClickInterceptedException;
import org.openqa.selenium.ElementNotInteractableException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Keys;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/**
 * Omar 2026-10-25 (online run #14: "stale element not found in the current frame"): Availo redraws its sign-in form
 * after the account code, so a box or button found a moment ago is gone. Each step finds its element again right before
 * it acts; a redrawn (stale), covered (click intercepted) or not-ready element is waited for and found again, a few
 * times; the last try of a covered button presses it by script. The selector keeps every design ("new, old").
 */
final class SignInAct {

    static final int TRIES = 4;

    private SignInAct() {
    }

    /** clicks what {@code selector} finds now ({@code first} = found just before); plain words when it never holds still */
    static void click(WebDriver driver, String selector, WebElement first) {
        WebElement e = first;
        RuntimeException last = null;
        for (int i = 0; i < TRIES; i++) {
            if (e == null) e = ScreenSignIn.find(driver, selector, 3000);
            if (e == null) break;
            try {
                if (i == TRIES - 1 && last instanceof ElementClickInterceptedException) {
                    ((JavascriptExecutor) driver).executeScript("arguments[0].click();", e); // covered every time: press it by script
                    WaitedReads.settled(driver, 2000);
                } else {
                    WaitedReads.clickWhenReady(driver, e, 5);
                }
                return;
            } catch (StaleElementReferenceException | ElementNotInteractableException redrawn) { // covered clicks too (a subclass)
                last = redrawn;
                gone(driver, e);
                e = null;
            }
        }
        throw new IllegalStateException(why(selector, last));
    }

    /** empties the box {@code selector} finds now and types {@code value}; found again when the form redraws */
    static void type(WebDriver driver, String selector, WebElement first, String value) {
        WebElement e = first;
        RuntimeException last = null;
        for (int i = 0; i < TRIES; i++) {
            if (e == null) e = ScreenSignIn.find(driver, selector, 3000);
            if (e == null) break;
            try {
                WaitedReads.typeWhenReady(driver, e, 5, Keys.chord(Keys.CONTROL, "a"), Keys.DELETE);
                e.clear(); // wait-ok: waited for shown + enabled just above
                WaitedReads.typeWhenReady(driver, e, 5, value);
                return;
            } catch (StaleElementReferenceException | ElementNotInteractableException redrawn) {
                last = redrawn;
                gone(driver, e);
                e = null;
            }
        }
        throw new IllegalStateException(why(selector, last));
    }

    /** waits (up to 2 s) until the old element has really left the page, so the next find gets the new one */
    private static void gone(WebDriver driver, WebElement old) {
        WaitedReads.within(driver, 2000, 100, d -> {
            try {
                old.isDisplayed();
                return null;
            } catch (StaleElementReferenceException left) {
                return Boolean.TRUE;
            }
        });
        WaitedReads.settled(driver, 1500);
    }

    private static String why(String selector, RuntimeException last) {
        String what = last instanceof ElementClickInterceptedException ? "something kept covering it"
                : last instanceof StaleElementReferenceException ? "the page kept redrawing it" : last != null ? "it never got ready" : "it was not there";
        return "the sign-in page's " + plain(selector) + " could not be used - " + what;
    }

    /** text=Send → "Send" button; a css selector → "box" */
    static String plain(String selector) {
        String s = selector == null ? "" : selector.split(",")[0].trim();
        if (s.startsWith("text=")) return "\"" + s.substring(5).replaceAll("^['\"]|['\"]$", "") + "\" button";
        return "box or button";
    }
}
