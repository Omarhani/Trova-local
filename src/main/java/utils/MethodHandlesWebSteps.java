package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

/**
 * The bottom of {@link MethodHandlesWeb}: finding an element, waiting for it, and the step code - the numbered box, the
 * step number, the Timeline's listener, the report line. setStep and addBorderToElement read the stack by depth: a
 * call between them and the helper that asks changes what they read. Public, so javac adds no bridge frames.
 */
public class MethodHandlesWebSteps {

    /** the classes of the helper chain: a step is told for the first frame outside them */
    private static final Set<String> HELPERS = Set.of(MethodHandlesWeb.class.getName(), MethodHandlesWebReads.class.getName(),
            MethodHandlesWebForms.class.getName(), MethodHandlesWebClicks.class.getName(), MethodHandlesWebSteps.class.getName());

    protected WebDriver driver;
    WebDriverWait wait;
    Actions actions;

    public MethodHandlesWebSteps(WebDriver driver) {
        this.driver = driver;
    }

    protected WebElement webElement(By locator) {
        return driver.findElement(locator);
    }

    protected List<WebElement> webElements(By locator) {
        return driver.findElements(locator);
    }

    protected void explicitWait(By locator, int time) {
        wait = new WebDriverWait(driver, Duration.ofSeconds(time)); // TICKET-980: signed out mid-test = sign in again, try once more
        SignedOutStep.once(driver, () -> wait.until(ExpectedConditions.and(ExpectedConditions.presenceOfElementLocated(locator), ExpectedConditions.elementToBeClickable(locator))));
        Covers.waitGone(driver); // Omar 2026-10-25: a loading layer over it is gone first, then the action
    }

    /**
     * Waits until the element is gone or hidden - "already gone" counts. It used to look the element up
     * first (webElement), which threw NoSuchElementException exactly when it had already disappeared
     * (a dialog that closed before the check ran).
     */
    protected void invisibilityOf(By locator, int time) {
        wait = new WebDriverWait(driver, Duration.ofSeconds(time));
        wait.until(ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    private static String getMethodName() {
        StackTraceElement[] stackTraceElements = Thread.currentThread().getStackTrace();
        if (stackTraceElements.length >= 2) {
            if (stackTraceElements.length >= 4)
                return stackTraceElements[4].getMethodName();
            return stackTraceElements[2].getMethodName();
        } else {
            return "Unknown";
        }
    }

    protected void setStep() {
        log(getMethodName());
    }

    /** Into the running test's report entry; nothing while none is open (between tests, class setup). */
    private static void log(Object line) {
        if (MethodHandlesWeb.test != null) {
            MethodHandlesWeb.test.info(line.toString());
        }
    }

    /** Numbers the highlighted steps of the running test; reset when a recording starts. */
    private static volatile int stepNumber;
    /** Runs right after a step is highlighted - the recorder hooks in here to take that frame. */
    private static Runnable onStep;
    /** Runs before the previous step's box is removed - the recorder makes sure that box was recorded. */
    private static Runnable beforeStep;
    /** Gets every step and assertion with its locator - the report's Timeline and the live view hook in here. */
    private static volatile Consumer<MethodHandlesWeb.Step> stepListener;


    public static void resetStepNumber() {
        stepNumber = 0;
    }

    /** The number of the step boxed last - the recorder notes it on every frame. */
    public static int currentStepNumber() {
        return stepNumber;
    }

    public static void setOnStep(Runnable callback) {
        onStep = callback;
    }

    public static void setBeforeStep(Runnable callback) {
        beforeStep = callback;
    }

    public static void setStepListener(Consumer<MethodHandlesWeb.Step> listener) {
        stepListener = listener;
    }

    private static void tellListener(MethodHandlesWeb.Step step) {
        Consumer<MethodHandlesWeb.Step> listener = stepListener;
        if (listener != null) {
            try {
                listener.accept(step);
            } catch (Exception ignored) {
                // the timeline is a report aid - it must never fail a test
            }
        }
    }

    /**
     * The locator an element was found with, from Selenium's own description of it
     * ({@code [[ChromeDriver: chrome on windows (id)] -> xpath: //button[.='Save']]} gives
     * {@code xpath: //button[.='Save']}); for an element found inside another, the inner locator.
     * Empty for an element that came back from a script.
     */
    static String locatorOf(WebElement element) {
        String text = String.valueOf(element);
        int arrow = text.lastIndexOf("] -> ");
        if (arrow < 0) {
            return "";
        }
        String locator = text.substring(arrow + 5);
        return locator.endsWith("]") ? locator.substring(0, locator.length() - 1) : locator;
    }

    /** The page object method (or test) that asked for the step: {@code LoginPage.clickSave}. */
    private static String caller() {
        return StackWalker.getInstance().walk(frames -> frames
                .filter(f -> !HELPERS.contains(f.getClassName())
                        && !f.getClassName().equals(ReportedAssertions.class.getName())
                        && !f.getClassName().startsWith("java.") && !f.getClassName().startsWith("jdk."))
                .findFirst()
                .map(f -> f.getClassName().substring(f.getClassName().lastIndexOf('.') + 1) + "." + f.getMethodName())
                .orElse(""));
    }

    static void assertion(boolean passed, String detail) {
        tellListener(new MethodHandlesWeb.Step(stepNumber, "assert", "", "", caller(), System.currentTimeMillis(), passed, detail));
    }

    /** Draws the numbered box and says what the Timeline calls the element. */
    private static final String STEP_BOX_SCRIPT =
                    "var el = arguments[0], d = document;" +
                            // what the Timeline calls the element: tag + its text, or an input's placeholder /
                            // label - never an input's value, which can be a password
                            "var field = /^(INPUT|TEXTAREA)$/.test(el.tagName);" +
                            "var t = (field ? (el.getAttribute('placeholder') || el.getAttribute('aria-label') ||" +
                            "  el.getAttribute('formcontrolname') || el.name || '') :" +
                            "  (el.textContent || el.getAttribute('aria-label') || '')).replace(/\\s+/g, ' ').trim();" +
                            "var label = el.tagName.toLowerCase() + (t ? ' \"' + (t.length > 40 ? t.slice(0, 40) + '...' : t) + '\"' : '');" +
                            "var r = el.getBoundingClientRect();" +
                            "if (!r.width && !r.height) return label;" +
                            "if (!d.getElementById('__aq_style')) {" +
                            "  var s = d.createElement('style'); s.id = '__aq_style';" +
                            "  s.textContent = '.__aq_box{position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;" +
                            "border:3px solid #ff2d55;border-radius:6px;background:rgba(255,45,85,.12);box-shadow:0 0 0 4px rgba(255,45,85,.25)}" +
                            ".__aq_box::before{content:attr(data-n);position:absolute;top:-18px;left:-18px;min-width:32px;height:32px;padding:0 8px;" +
                            "box-sizing:border-box;border-radius:16px;background:#ff2d55;color:#fff;font:bold 18px/32px Arial,sans-serif;text-align:center}" +
                            ".__aq_box::after{content:attr(data-l);position:absolute;top:-15px;left:20px;padding:2px 8px;border-radius:4px;" +
                            "background:#1f2937;color:#fff;font:bold 15px/20px Arial,sans-serif;white-space:nowrap}';" +
                            "  d.head.appendChild(s);" +
                            // boxes follow their element on any scroll (capture = inner panels too) or resize
                            "  var follow = function () { d.querySelectorAll('.__aq_box').forEach(function (x) {" +
                            "    if (!x.__el) return; var q = x.__el.getBoundingClientRect();" +
                            "    x.style.left = (q.left - 5) + 'px'; x.style.top = (q.top - 5) + 'px';" +
                            "    x.style.width = (q.width + 10) + 'px'; x.style.height = (q.height + 10) + 'px'; }); };" +
                            "  d.addEventListener('scroll', follow, true); window.addEventListener('resize', follow);" +
                            "}" +
                            "d.querySelectorAll('.__aq_box').forEach(function (x) { x.remove(); });" +
                            "var b = d.createElement('div'); b.className = '__aq_box'; b.__el = el;" +
                            "b.setAttribute('data-n', arguments[1]); b.setAttribute('data-l', arguments[2]);" +
                            "b.style.left = (r.left - 5) + 'px'; b.style.top = (r.top - 5) + 'px';" +
                            "b.style.width = (r.width + 10) + 'px'; b.style.height = (r.height + 10) + 'px';" +
                            "d.body.appendChild(b);" +
                            "setTimeout(function () { b.remove(); }, 1500);" +
                            "return label;";

    /**
     * Highlights the element the next step acts on: a box around it with the step number and the
     * action ("3 click", "4 type"). It is an overlay - the element's own style and the layout are
     * untouched, clicks pass through it (pointer-events: none), and the number and label are CSS
     * generated content, so no XPath text() ever matches them.
     *
     * <p>Only the current step is boxed: the next step removes the previous box (once the recorder has
     * it on a frame), and a box left alone removes itself after 1.5 s. While it is up it follows its
     * element when the page or a panel scrolls, so it never floats over the wrong thing.
     */
    static void addBorderToElement(WebDriver driver, WebElement element) {
        addBorderToElement(driver, element, actionLabel(Thread.currentThread().getStackTrace()[2].getMethodName()));
    }

    /**
     * The same numbered box, for a step a page object does without the wrappers above (a JS click, an
     * option picked inside a retry, a toast read with its own wait). Never throws: if the element is gone,
     * there is simply no box.
     */
    protected void highlight(WebElement element, String action) {
        addBorderToElement(driver, element, action);
    }

    protected void highlight(By locator, String action) {
        try {
            addBorderToElement(driver, webElement(locator), action);
        } catch (Exception ignored) {
            // cosmetic only
        }
    }

    static void addBorderToElement(WebDriver driver, WebElement element, String action) {
        if (beforeStep != null) {
            beforeStep.run();
        }
        Object label;
        try {
            label = ((JavascriptExecutor) driver).executeScript(STEP_BOX_SCRIPT,
                    element, String.valueOf(stepNumber + 1), action);
        } catch (Exception ignored) {
            return; // highlighting is cosmetic - it must never fail a test
        }
        // counted once the box is up, so a frame that notes this number really shows this step's box
        stepNumber++;
        tellListener(new MethodHandlesWeb.Step(stepNumber, action, locatorOf(element), label == null ? "" : label.toString(),
                caller(), System.currentTimeMillis(), null, null));
        if (onStep != null) {
            onStep.run();
        }
    }

    private static String actionLabel(String helper) {
        String h = helper.toLowerCase();
        if (h.startsWith("sendkeys")) return "type";
        if (h.startsWith("clear")) return "clear";
        if (h.startsWith("submit")) return "submit";
        if (h.startsWith("gettext") || h.startsWith("is")) return "check";
        if (h.startsWith("movetoelement")) return "hover";
        if (h.startsWith("draganddrop")) return "drag";
        if (h.startsWith("release")) return "release";
        if (h.startsWith("doubleclick")) return "double click";
        if (h.startsWith("contextclick")) return "right click";
        if (h.startsWith("clickandhold")) return "hold";
        return "click";
    }

    public void scrollIntoView(By locator) {
        WebElement targetCell = driver.findElement(locator);
        JavascriptExecutor js = (JavascriptExecutor) driver;

        js.executeScript(
                "var elem = arguments[0];" +
                        "if (!elem) return;" +

                        "// 1. Check if Angular NgZone / Component APIs are accessible on the element" +
                        "var ngContainer = elem.closest('.table-responsive') || elem.parentElement;" +

                        "// 2. Use modern Angular element scrollIntoView with inline center options" +
                        "elem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });" +

                        "// 3. Dispatch Angular CDK scroll event so ChangeDetectorRef picks up the move" +
                        "var event = new Event('scroll', { bubbles: true });" +
                        "elem.dispatchEvent(event);" +
                        "if (ngContainer) ngContainer.dispatchEvent(event);",
                targetCell
        );
    }

    protected void scrollIntoElement(WebElement element) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript(
                "var elem = arguments[0];" +
                        "var rect = elem.getBoundingClientRect();" +
                        // Calculate absolute position on the page relative to window scroll
                        "var elementAbsoluteTop = rect.top + window.pageYOffset;" +
                        "var elementAbsoluteLeft = rect.left + window.pageXOffset;" +
                        // Calculate center offsets subtracting half of viewport size and adding half of element size
                        "var targetY = elementAbsoluteTop - (window.innerHeight / 2) + (rect.height / 2);" +
                        "var targetX = elementAbsoluteLeft - (window.innerWidth / 2) + (rect.width / 2);" +
                        // Scroll the window directly to the centered coordinates
                        "window.scrollTo({ top: targetY, left: targetX, behavior: 'instant' });",
                element
        );
    }
}
