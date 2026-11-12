package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.android.AndroidDriver;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mobile-specific helper similar in purpose to the existing MethodHandles but
 * focused on Appium/mobile flows. Phase 1 provides Actions-based click
 * and sendKeys plus a getText helper, and tapAtOffset for precise coordinate taps.
 */
public class MethodHandlesMobile extends MethodHandlesMobileSteps {

    public MethodHandlesMobile(AndroidDriver androidDriver) {
        super(androidDriver);
    }

    // Short verification timeout (milliseconds) used after a click to detect
    // whether the UI changed. Keep this small to avoid adding test time.
    // How long a click waits for its element to go stale (= the tap landed) before tapping once more.
    // Returns as soon as the screen changes. Was 250 ms, which only worked while waitForIdleTimeout (4 s)
    // made every check wait for the app: with that at 0, a slow submit got a second tap that undid
    // the first one.
    private static final int SHORT_CLICK_VERIFY_MS = 3000;

    /** Called when a step is about to act on an element - the phone recorder draws its numbered box. */
    public interface StepListener {
        void onStep(Rectangle rect, int number, String action);
    }

    /**
     * Exactly one tap - for buttons that submit or navigate (a submit button, a confirm action, back
     * to home). {@link #click} taps again when the element has not gone stale within 3 s; on these
     * that second tap submitted or skipped a screen on its own (the next screen's action button can
     * sit where the first button was). A stale element before the tap is still found again, so a redraw
     * cannot swallow the tap.
     */
    protected void clickOnce(By locator, int time) {
        tapOnce(locator, time);
        setStep();
    }

    // setStep stays in the callers: it logs the screen method two frames up
    private void tapOnce(By locator, int time) {
        explicitWait(locator, time, POLL_MS);
        for (int attempt = 1; ; attempt++) {
            try {
                WebElement element = webElement(locator);
                markStep(element);
                tap(element);
                break;
            } catch (StaleElementReferenceException | NoSuchElementException stale) {
                // redrawn, or gone for a moment between the wait and the find: home reloads right after
                // login and a home button was missing 100 ms after it showed (over USB)
                if (attempt == 3) {
                    throw stale;
                }
                explicitWait(locator, time, POLL_MS);
            }
        }
    }

    /**
     * One tap on a text field, to focus it before {@link #sendKeys}. {@link #click} waits up to 3 s for the
     * element to go stale and then taps again - a field never goes stale, so every field paid 3 s, and on a
     * fast USB run the second tap closed the bottom sheet the field was on.
     */
    protected void tapField(By locator, int time) {
        tapOnce(locator, time);
        setStep();
    }

    protected void click(By locator, int time) {
        // Ensure the element is present before interacting
        explicitWait(locator, time, POLL_MS);

        // The screen can redraw between finding the element and tapping it (the home screen reloads
        // its data right after a submit), which leaves a stale element: find it again
        // and tap, up to 3 times. Without this the next tap was lost.
        WebElement element = null;
        for (int attempt = 1; ; attempt++) {
            try {
                element = webElement(locator);
                markStep(element);
                tap(element);
                break;
            } catch (StaleElementReferenceException stale) {
                if (attempt == 3) {
                    throw stale;
                }
                explicitWait(locator, time, POLL_MS);
            }
        }

        tapAgainIfNothingChanged(element);
        setStep();
    }

    private void tapAgainIfNothingChanged(WebElement element) {
        // Quickly verify whether the click caused a UI change. Keep this check very short
        // to avoid adding latency to test runs. If the element does NOT become stale within
        // the short timeout, perform one quick retry tap.
        try {
            WebDriverWait shortWait = new WebDriverWait(androidDriver, Duration.ofMillis(SHORT_CLICK_VERIFY_MS));
            // If the element becomes stale quickly, the click had effect and we return.
            shortWait.until(org.openqa.selenium.support.ui.ExpectedConditions.stalenessOf(element));
        } catch (org.openqa.selenium.TimeoutException timeout) {
            // Element didn't become stale within the short timeout -> retry a native tap
            try {
                Rectangle r = element.getRect();
                int centerX = r.getX() + (r.getWidth() / 2);
                int centerY = r.getY() + (r.getHeight() / 2);

                PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
                Sequence tap = new Sequence(finger, 1);
                tap.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), centerX, centerY));
                tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
                tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

                androidDriver.perform(Collections.singletonList(tap));
            } catch (Exception ignore) {
                // best-effort retry — swallow to avoid test slowdown
            }
        } catch (Exception ignored) {
            // ignore any other unexpected exception from the quick verification
        }
    }

    /**
     * Mobile equivalent of MethodHandlesWeb.smartClick.
     * Performs a single attempt Actions click and falls back to a native touch tap
     * if Actions fails. Does NOT perform verification or multiple retries to keep
     * execution time low.
     */
    protected void smartClick(By locator, int time) {
        // Ensure the element is present quickly before interacting
        explicitWait(locator, time, 200);

        Actions actions = new Actions(androidDriver);

        try {
            WebElement element = webElement(locator);
            markStep(element);
            // Try Actions-based click first
            actions.moveToElement(element).pause(Duration.ofMillis(200)).click().build().perform();
        } catch (Exception e) {
            // Fallback to a quick native tap at element center
            try {
                WebElement element = webElement(locator);
                Rectangle r = element.getRect();
                int centerX = r.getX() + (r.getWidth() / 2);
                int centerY = r.getY() + (r.getHeight() / 2);

                PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
                Sequence tap = new Sequence(finger, 1);
                tap.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), centerX, centerY));
                tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
                tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

                androidDriver.perform(Collections.singletonList(tap));
            } catch (Exception e2) {
                throw new RuntimeException("Smart click failed for locator: " + locator.toString(), e2);
            }
        }
        setStep();
    }

    /**
     * Sends keys to an element. For Flutter apps, this uses a reliable
     * "select all" and overwrite strategy to clear the field before typing.
     */
    protected void sendKeys(By locator, String text, int time) {
        wait = new WebDriverWait(androidDriver, Duration.ofSeconds(time));
        explicitWait(locator, time, POLL_MS);
        markStep(webElement(locator));

        // A more robust way to clear text in Flutter is to select all and overwrite.
        // This avoids issues with cursor position or counting backspaces.
        Actions actions = new Actions(androidDriver);

        // Send CTRL+A to select all existing text.
        actions.keyDown(Keys.CONTROL).sendKeys("a").keyUp(Keys.CONTROL);

        // Send the new text, which overwrites the selection, and then perform.
        actions.sendKeys(text).perform();
        setStep();
    }

    /**
     * Checks if an element is interactable by attempting to move to it.
     * This is a reliable way to check for element presence in Flutter apps.
     *
     * @return True if the element can be moved to, false otherwise.
     */
    protected boolean isDisplayed(By locator, int time) {
        try {
            explicitWait(locator, time, 500);
            WebElement element = webElement(locator);
            markStep(element);
            Actions actions = new Actions(androidDriver);
            actions.moveToElement(element).perform();
            setStep();
            return true;
        } catch (Exception e) {
            System.out.println(locator + "❌ is Not appeared");
            // If we hit an exception while checking display, treat as not displayed
            return false;
        }
    }

    /**
     * Scrolls to an element and clicks it. It will swipe a maximum of 10 times.
     */
    protected void scrollAndClick(By locator) {
        int swipes = 0;
        while (swipes < 10) {
            // Use findElements to avoid throwing an exception if the element is not yet visible.
            List<WebElement> elements = androidDriver.findElements(locator);
            if (!elements.isEmpty() && elements.get(0).isDisplayed()) {
                click(locator, 5);
                return; // Exit the method once the element is found and clicked.
            }
            // Perform a swipe gesture to scroll down.
            swipeDown();
            swipes++;
        }
        // If the element is not found after 10 swipes, throw an exception.
        throw new NoSuchElementException("Element with locator " + locator + " not found after 10 swipes.");
    }

    /**
     * Read a toaster / message element (Flutter or mobile) and store it in the global
     * toasterMessage field for tests/pages to reuse.
     */
    protected String getToasterContent(By locator) {
        return getFlutterText(locator);
    }

    /**
     * Waits for toaster to appear first, then waits for it to disappear
     * This replaces Thread.sleep() with dynamic waiting
     */
    protected void waitForToasterToAppear() {
        // Step 1: Wait for toaster to appear (1-2 seconds max)
        try {
            wait = new WebDriverWait(androidDriver, Duration.ofSeconds(5));
            wait.until(ExpectedConditions.presenceOfElementLocated(toasterMessage));
            System.out.println("✅ Toaster appeared");

        } catch (Exception e) {
            System.out.println("❌ Toaster Not appeared");
        }

    }

    protected void clickFlutterLeftAsset(By locator) {
        // 1. Find the target element using the passed locator
        WebElement element = androidDriver.findElement(locator);
        markStep(element);

        // 2. Get its exact screen position boundaries
        Rectangle rect = element.getRect();

        // 3. Calculate the target point:
        // Move 50 pixels to the right of the element's left edge (X)
        // Move to the exact middle vertically (Y)
        int clickX = rect.getX() + 50;
        int clickY = rect.getY() + (rect.getHeight() / 2);

        // 4. Construct and perform the precise native finger tap gesture
        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence tap = new Sequence(finger, 1);

        tap.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), clickX, clickY));
        tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        androidDriver.perform(Collections.singletonList(tap));
        setStep();
    }


    protected String getFlutterText(By locator) {
        // Use explicit wait to ensure element is present
        explicitWait(locator, 15, 500);
        WebElement element = androidDriver.findElement(locator);
        markStep(element);
        setStep();

        // 1. Check content-desc first (standard for Flutter elements)
        String text = element.getAttribute("content-desc");

        // 2. Fallback to standard text attribute if content-desc is empty or null
        if (text == null || text.trim().isEmpty()) {
            text = element.getAttribute("text");
        }

        return text != null ? text.trim() : "";
    }

    public String getToasterMessage() {
        waitForToasterToAppear();
        return getToasterContent(toasterMessage);
    }

    /**
     * The snackbar reads "&lt;title&gt;, &lt;message&gt;", and on the English success toasts both are the same
     * text ("Saved successfully, Saved successfully"),
     * so this returns it once. Anything else comes back unchanged.
     */
    public String getToasterMessageOnce() {
        String text = readToasterText(10);
        int middle = text.length() / 2;
        if (text.length() > 2 && text.startsWith(", ", middle - 1)) {
            String first = text.substring(0, middle - 1);
            if (first.equals(text.substring(middle + 1))) {
                return first;
            }
        }
        return text;
    }

    private static final Pattern SNACKBAR_NODE =
            Pattern.compile("<[^>]*resource-id=\"(?:success|error)_snackbar\"[^>]*>");

    /**
     * The snackbar shows ~3 s, and a phone call takes 0.3 s on a good run but 2-5 s on a slow one.
     * Find-then-read is two calls, and the toast went stale between them. So this reads one
     * snapshot of the screen (page source) and takes the snackbar's content-desc out of it: nothing to go
     * stale. The step box is drawn afterwards if the toast is still there.
     */
    private String readToasterText(int seconds) {
        long deadline = System.currentTimeMillis() + seconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            Matcher node = SNACKBAR_NODE.matcher(androidDriver.getPageSource());
            if (node.find()) {
                Matcher desc = CONTENT_DESC.matcher(node.group());
                if (desc.find() && !desc.group(1).isBlank()) {
                    try {
                        markStep(androidDriver.findElement(toasterMessage));
                        setStep();
                    } catch (Exception gone) {
                        // the box is for the recording only; the toast may already be gone
                    }
                    return unescapeXml(desc.group(1)).trim();
                }
            }
            try {
                Thread.sleep(POLL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new org.openqa.selenium.TimeoutException("No toast within " + seconds + " s");
    }

    private static String unescapeXml(String value) {
        return value.replace("&#10;", "\n").replace("&quot;", "\"").replace("&apos;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
    }

    public boolean toasterMessageIsDisplayed() {
        waitForToasterToAppear();
        return isDisplayed(toasterMessage, 10);

    }

}