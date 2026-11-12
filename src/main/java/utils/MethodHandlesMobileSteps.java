package utils;

import io.appium.java_client.AppiumBy;
import io.appium.java_client.android.AndroidDriver;
import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The bottom of {@link MethodHandlesMobile}: finding an element, the step code, and gestures. setStep and markStep read
 * the stack by depth: a call between them and the helper that asks changes what they read. Public, so javac adds no
 * bridge frames.
 */
public class MethodHandlesMobileSteps {

    protected WebDriverWait wait;
    final AndroidDriver androidDriver;
    // Global toaster message for mobile flows
    protected final By toasterMessage =
            AppiumBy.xpath("//android.widget.ImageView[@resource-id='error_snackbar' or @resource-id='success_snackbar']");

    public MethodHandlesMobileSteps(AndroidDriver androidDriver) {
        this.androidDriver = androidDriver;
    }

    protected void explicitWait(By locator, int time, int sleep) {
        wait = new WebDriverWait(androidDriver, Duration.ofSeconds(time), Duration.ofMillis(sleep));
        wait.until(ExpectedConditions.presenceOfElementLocated(locator));
    }

    protected WebElement webElement(By locator) {
        return androidDriver.findElement(locator);
    }

    /** Numbers the steps of the running test; reset when a recording starts. */
    private static int stepNumber;
    private static MethodHandlesMobile.StepListener onStep;

    public static void resetStepNumber() {
        stepNumber = 0;
    }

    public static void setOnStep(MethodHandlesMobile.StepListener listener) {
        onStep = listener;
    }

    /**
     * Mobile twin of MethodHandlesWeb's step highlight: numbers the step and hands the element's
     * position and the action ("click", "type") to the recorder. Cosmetic - it never fails a test.
     */
    static void markStep(WebElement element) {
        String action = actionLabel(Thread.currentThread().getStackTrace()[2].getMethodName());
        int number = ++stepNumber;
        MethodHandlesMobile.StepListener listener = onStep;
        if (listener == null) {
            return;
        }
        try {
            listener.onStep(element.getRect(), number, action);
        } catch (Exception ignored) {
            // highlighting is cosmetic
        }
    }

    private static String actionLabel(String helper) {
        String h = helper.toLowerCase();
        if (h.startsWith("sendkeys")) return "type";
        if (h.startsWith("get") || h.startsWith("is")) return "check";
        return "click";
    }

    /** Logs the screen method that ran (e.g. insertAccountCode) as a step in the report, as the web does. */
    protected void setStep() {
        if (MethodHandlesWeb.test != null) {
            MethodHandlesWeb.test.info(getMethodName());
        }
    }

    private static String getMethodName() {
        StackTraceElement[] stackTraceElements = Thread.currentThread().getStackTrace();
        if (stackTraceElements.length >= 5) {
            return stackTraceElements[4].getMethodName();
        }
        return stackTraceElements.length >= 2 ? stackTraceElements[2].getMethodName() : "Unknown";
    }


    /**
     * Clicks an element using Actions (moveToElement + click). Waits until element is clickable.
     */
    // How often a wait looks for its element again. Was 2000 ms: every element not on screen at the
    // first look cost a full 2 s (9 times in one run).
    static final int POLL_MS = 250;

    static final Pattern CONTENT_DESC = Pattern.compile("content-desc=\"([^\"]*)\"");

    /**
     * Waits until the screen stops changing: the same texts (every content-desc on the page) for
     * {@code quietMs} in a row, at most {@code maxSeconds}. For a screen that loads in steps and rebuilds
     * itself - acting in between lands on a screen that is about to be replaced.
     */
    protected void waitForScreenToSettle(int quietMs, int maxSeconds) {
        long deadline = System.currentTimeMillis() + maxSeconds * 1000L;
        String last = null;
        long unchangedSince = System.currentTimeMillis();
        while (System.currentTimeMillis() < deadline) {
            Matcher desc = CONTENT_DESC.matcher(androidDriver.getPageSource());
            StringBuilder texts = new StringBuilder();
            while (desc.find()) {
                texts.append(desc.group(1)).append('|');
            }
            long now = System.currentTimeMillis();
            if (!texts.toString().equals(last)) {
                last = texts.toString();
                unchangedSince = now;
            } else if (now - unchangedSince >= quietMs) {
                return;
            }
            try {
                Thread.sleep(POLL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        System.out.println("⚠️ Screen still changing after " + maxSeconds + " s - going on");
    }

    /** True when the element is there within {@code seconds}; no step logged, nothing tapped. */
    protected boolean isPresent(By locator, int seconds) {
        try {
            new WebDriverWait(androidDriver, Duration.ofSeconds(seconds), Duration.ofMillis(POLL_MS))
                    .until(ExpectedConditions.presenceOfElementLocated(locator));
            return true;
        } catch (TimeoutException e) {
            return false;
        }
    }

    /**
     * Closes and reopens the app (still logged in). A fresh start reloads everything from the server -
     * the only thing that made the home screen show a newly created record (pull to refresh and
     * switching tabs fetched nothing).
     */
    protected void restartApp() {
        String app = androidDriver.getCurrentPackage();
        // Shell, not terminateApp/activateApp: activateApp left the app closed for ~70 s.
        // Needs the server's uiautomator2:adb_shell (BaseTests starts Appium with it).
        shell("am", "force-stop", app);
        shell("monkey", "-p", app, "-c", "android.intent.category.LAUNCHER", "1");
    }

    private void shell(String command, String... args) {
        androidDriver.executeScript("mobile: shell", Map.of("command", command, "args", List.of(args)));
    }

    /** Actions click; a native tap at the element's centre if that fails. Throws if both fail. */
    void tap(WebElement element) {
        try {
            new Actions(androidDriver).moveToElement(element).click().build().perform();
        } catch (Exception e) {
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
                // If fallback also fails, rethrow the original to surface the issue
                throw e;
            }
        }
    }

    /** One native tap at a screen point - for an icon that has no accessibility node to find. */
    protected void tapPoint(int x, int y) {
        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence tap = new Sequence(finger, 1);
        tap.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), x, y));
        tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        androidDriver.perform(Collections.singletonList(tap));
        setStep();
    }

    /** Closes the keyboard if one is open, so it cannot cover a button below the field. */
    protected void hideKeyboardIfShown() {
        try {
            if (androidDriver.isKeyboardShown()) {
                androidDriver.hideKeyboard();
            }
        } catch (Exception ignored) {
            // no keyboard to hide
        }
    }

    /**
     * Scrolls inside {@code list} (not the whole screen) until {@code item} shows as a full row, then returns.
     * A clipped row is still in the tree with a shorter height (Live-Dr was 88 px, the others 96), so "found"
     * is not enough: the row must be at least 90% of the tallest row showing. Swipes towards the end first,
     * then back towards the start, {@code maxSwipes} each way.
     */
    protected void scrollIntoViewWithin(By list, By item, int maxSwipes) {
        explicitWait(list, 10, POLL_MS);
        for (int swipe = 0; swipe <= 2 * maxSwipes; swipe++) {
            List<WebElement> found = androidDriver.findElements(item);
            if (!found.isEmpty() && isFullRow(found.get(0))) {
                return;
            }
            if (swipe < 2 * maxSwipes) {
                swipeWithin(webElement(list).getRect(), swipe < maxSwipes);
            }
        }
        throw new NoSuchElementException(item + " not shown in " + list + " after " + maxSwipes + " swipes each way");
    }

    private boolean isFullRow(WebElement element) {
        try {
            int height = element.getRect().getHeight();
            // compared with the other rows of the same class
            String siblings = "//" + element.getAttribute("class");
            int tallest = androidDriver.findElements(By.xpath(siblings)).stream()
                    .mapToInt(e -> e.getRect().getHeight()).max().orElse(height);
            return height > 0 && height >= tallest * 0.9;
        } catch (StaleElementReferenceException redrawn) {
            return false;
        }
    }

    /** One slow swipe inside {@code area}: {@code revealBelow} moves the content up to show what is below. */
    protected void swipeWithin(Rectangle area, boolean revealBelow) {
        int x = area.getX() + area.getWidth() / 2;
        int low = area.getY() + (int) (area.getHeight() * 0.8);
        int high = area.getY() + (int) (area.getHeight() * 0.2);
        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence swipe = new Sequence(finger, 1);
        swipe.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), x, revealBelow ? low : high));
        swipe.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        swipe.addAction(finger.createPointerMove(Duration.ofMillis(600), PointerInput.Origin.viewport(), x, revealBelow ? high : low));
        swipe.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        androidDriver.perform(Collections.singletonList(swipe));
    }

    /**
     * Performs a swipe down gesture on the screen.
     */
    void swipeDown() {
        Dimension size = androidDriver.manage().window().getSize();
        int startX = size.getWidth() / 2;
        int startY = (int) (size.getHeight() * 0.8);
        int endY = (int) (size.getHeight() * 0.2);

        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence swipe = new Sequence(finger, 1);
        swipe.addAction(finger.createPointerMove(Duration.ofMillis(0), PointerInput.Origin.viewport(), startX, startY));
        swipe.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        swipe.addAction(finger.createPointerMove(Duration.ofMillis(1000), PointerInput.Origin.viewport(), startX, endY));
        swipe.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        androidDriver.perform(Collections.singletonList(swipe));
    }

}
