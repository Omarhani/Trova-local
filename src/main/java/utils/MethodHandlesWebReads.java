package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/** Reads, checks and toasts of {@link MethodHandlesWeb}. */
public class MethodHandlesWebReads extends MethodHandlesWebForms {

    // General Locators - ngx-toastr's container and alert; a page object of an app with other toasts sets its own
    protected By toaster = By.id("toast-container");
    protected By toasterContent = By.xpath("//div[@role='alert']");

    public MethodHandlesWebReads(WebDriver driver) {
        super(driver);
    }

    public String getToasterContent() {
        return UiText.withoutClose(getText(toasterContent, 5)); // TICKET-982: never "Saved successfully×"
    }

    /**
     * Waits for toaster to appear first, then waits for it to disappear
     * This replaces Thread.sleep() with dynamic waiting
     */
    public void waitForToasterToAppearAndDisappear() {
        try {
            // Step 1: Wait for toaster to appear (1-2 seconds max)
            wait = new WebDriverWait(driver, Duration.ofSeconds(2));
            wait.until(ExpectedConditions.visibilityOfElementLocated(toaster));
            System.out.println("✅ Toaster appeared");
            highlightToast();

            // Step 2: Wait for toaster to disappear (up to 5 seconds)
            wait = new WebDriverWait(driver, Duration.ofSeconds(5));
            wait.until(ExpectedConditions.invisibilityOfElementLocated(toaster));
            System.out.println("✅ Toaster disappeared");

        } catch (Exception e) {
            // If toaster doesn't appear within 2 seconds, that's fine - just continue
            System.out.println("ℹ️ Toaster didn't appear within 2 seconds, continuing...");
        }
    }

    /**
     * Alternative method: Wait for toaster with custom timeouts
     *
     * @param appearTimeout    - seconds to wait for toaster to appear
     * @param disappearTimeout - seconds to wait for toaster to disappear
     */
    protected void waitForToaster(int appearTimeout, int disappearTimeout) {
        try {
            // Wait for toaster to appear
            wait = new WebDriverWait(driver, Duration.ofSeconds(appearTimeout));
            wait.until(ExpectedConditions.visibilityOfElementLocated(toaster));
            System.out.println("✅ Toaster appeared");
            highlightToast();

            // Wait for toaster to disappear
            wait = new WebDriverWait(driver, Duration.ofSeconds(disappearTimeout));
            wait.until(ExpectedConditions.invisibilityOfElementLocated(toaster));
            System.out.println("✅ Toaster disappeared");

        } catch (Exception e) {
            System.out.println("ℹ️ Toaster handling completed");
        }
    }

    /** The toast that just showed - boxed so the recording shows which message a step waited for or read. */
    private void highlightToast() {
        highlight(toasterContent, "toast");
    }

    protected String getText(By locator, int time) {
        String text = null;
        explicitWait(locator, time);

        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                text = webElement(locator).getText();
                break;
            } catch (StaleElementReferenceException e) {
                // Retry loop
            }
        }
        setStep();
        return text;
    }

    protected String getTextUsingHorizontalScroll(By locator) {
        String text = null;

        for (int i = 0; i < 5; i++) {
            try {
                // 1. Perform RTL-aware horizontal scroll
                scrollIntoView(locator);

                WebElement targetElement = driver.findElement(locator);
                addBorderToElement(driver, targetElement);

                // 2. Extract text (falls back to textContent if hidden by off-screen rendering)
                text = targetElement.getText();
                if (text == null || text.trim().isEmpty()) {
                    text = (String) ((JavascriptExecutor) driver).executeScript(
                            "return (arguments[0].innerText || arguments[0].textContent || '').replace(/\\s+/g, ' ').trim();",
                            targetElement
                    );
                }

                if (text != null && !text.trim().isEmpty()) {
                    break;
                }
            } catch (StaleElementReferenceException e) {
                // Retry on Angular DOM refresh
            }
        }

        setStep();
        return text;
    }

    protected String getTextFromDOM(By locator, int time) {
        String text = null;
//        explicitWait(locator, time);

        for (int i = 0; i < 5; i++) {
            try {
                // Find the element directly in the DOM tree
                WebElement targetElement = driver.findElement(locator);

                // Execute JS to grab the raw textContent directly from DOM memory
                text = (String) ((JavascriptExecutor) driver).executeScript(
                        "var elem = arguments[0];" +
                                "if (!elem) return '';" +
                                "return elem.textContent || elem.innerText || '';",
                        targetElement
                );

                if (text != null && !text.trim().isEmpty()) {
                    // Clean up extra spaces, non-breaking spaces (\u00a0), and line breaks
                    text = text.replaceAll("[\\s\\u00a0]+", " ").trim();

                    // the same numbered step box as every other read (it was a plain red border)
                    addBorderToElement(driver, targetElement, "check");
                    break;
                }
            } catch (StaleElementReferenceException e) {
                // Retry if Angular re-renders the DOM row
            } catch (Exception e) {
                // Catch potential JS exceptions during DOM evaluation
            }
        }

        setStep();
        return text;
    }

    // TICKET-983: waited reads for assertions - poll until the expected state, return what was seen (utils.WaitedReads).
    protected int countBecomes(By locator, int expected, int seconds) { return WaitedReads.countBecomes(driver, locator, expected, seconds); }
    protected int settledCount(By locator, int seconds) { return WaitedReads.settledCount(driver, locator, seconds); }
    protected boolean isShownWithin(By locator, int seconds) { return WaitedReads.isShownWithin(driver, locator, seconds); }
    protected boolean isGoneWithin(By locator, int seconds) { return WaitedReads.isGoneWithin(driver, locator, seconds); }
    protected boolean isEnabledWithin(By locator, int seconds) { return WaitedReads.isEnabledWithin(driver, locator, seconds); }
    protected boolean isDisabledWithin(By locator, int seconds) { return WaitedReads.isDisabledWithin(driver, locator, seconds); }
    protected String textBecomes(By locator, String expected, int seconds) { return WaitedReads.textBecomes(driver, locator, expected, seconds); }
    protected String messageOf(By locator, int seconds) { return WaitedReads.messageOf(driver, locator, seconds); }
    protected String valueBecomes(By locator, String expected, int seconds) { return WaitedReads.valueBecomes(driver, locator, expected, seconds); }

    protected String getTextViaJS(By locator, int time) {
        explicitWait(locator, time);

        WebElement element = driver.findElement(locator);

        // JS reads clean inner text directly from Angular's DOM tree
        String script =
                "var elem = arguments[0];" +
                        "elem.scrollIntoView({block: 'nearest', inline: 'center'});" +
                        "return elem.innerText.replace(/\\s+/g, ' ').trim();";

        String text = (String) ((JavascriptExecutor) driver).executeScript(script, element);
        highlight(element, "check");
        return text;
    }

    protected boolean isSelected(By locator, int time) {
        boolean flag = false;
        explicitWait(locator, time);

        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                flag = webElement(locator).isSelected();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
        return flag;
    }

    protected boolean isDisplayed(By locator, int time) {
        boolean flag;
        explicitWait(locator, time);
        scrollIntoElement(webElement(locator));
        flag = webElement(locator).isDisplayed();

        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                flag = webElement(locator).isDisplayed();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
        return flag;
    }

    protected boolean isEnabled(By locator, int time) {
        boolean flag;
        explicitWait(locator, time);
        scrollIntoElement(webElement(locator));
        flag = webElement(locator).isDisplayed();

        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                flag = webElement(locator).isEnabled();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
        return flag;

    }

}
