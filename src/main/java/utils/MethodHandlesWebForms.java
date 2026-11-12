package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/** Typing, selects, uploads and alerts of {@link MethodHandlesWeb}. */
public class MethodHandlesWebForms extends MethodHandlesWebClicks {

    Select select;

    public MethodHandlesWebForms(WebDriver driver) {
        super(driver);
    }

    public void insertTimeMovement(String timeToSet, By locator) {
        JavascriptExecutor js = (JavascriptExecutor) driver;

        String script =
                "var el = arguments[0]; " +
                        "var val = arguments[1]; " +
                        "var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; " +
                        "setter.call(el, val); " +
                        "el.dispatchEvent(new Event('input', { bubbles: true })); " +
                        "el.dispatchEvent(new Event('change', { bubbles: true }));";

        highlight(locator, "type");
        js.executeScript(script, webElement(locator), timeToSet);
//        setStep();
    }

    protected void waitAlert(int time) {
        wait = new WebDriverWait(driver, Duration.ofSeconds(time));
        wait.until(ExpectedConditions.alertIsPresent());
    }

    public void selectByVisibleText(By locator, String visibleText, int time) {
        explicitWait(locator, time);
        highlight(locator, "select");
        select = new Select(webElement(locator));
        select.selectByVisibleText(visibleText);
    }

    public void selectByValue(By locator, String value, int time) {
        explicitWait(locator, time);
        highlight(locator, "select");
        select = new Select(webElement(locator));
        select.selectByValue(value);
    }

    public void selectByIndex(By locator, int index, int time) {
        explicitWait(locator, time);
        highlight(locator, "select");
        select = new Select(webElement(locator));
        select.selectByIndex(index);
    }

    protected void acceptAlert(int time) {
        waitAlert(time);
        driver.switchTo().alert().accept();
    }

    protected void dismissAlert(int time) {
        waitAlert(time);
        driver.switchTo().alert().dismiss();
    }

    protected void sendKeysAlert(String text, int time) {
        waitAlert(time);
        driver.switchTo().alert().sendKeys(text);
    }

    protected String getTextAlert(int time) {
        waitAlert(time);
        return driver.switchTo().alert().getText();
    }

    protected void sendKeysWithEnter(By locator, String text) {
        highlight(locator, "type");
        actions = new Actions(driver);
        actions.sendKeys(webElement(locator), text)
                .perform();
        actions.sendKeys(webElement(locator),Keys.ENTER)
                .perform();
    }
    protected void sendKeysWithEnterAndEscape(By locator, String text) {
        highlight(locator, "type");
        actions = new Actions(driver);
        actions.sendKeys(webElement(locator), text)
                .perform();
        actions.sendKeys(webElement(locator),Keys.ENTER)
                .perform();
        actions.sendKeys(webElement(locator),Keys.ESCAPE)
                .perform();
    }

    /** presses one key (Keys.TAB, Keys.ENTER ...) in the field once it is clickable - no clear, no value check */
    protected void pressKey(By locator, int seconds, CharSequence key) {
        explicitWait(locator, seconds);
        webElement(locator).sendKeys(key);
        setStep();
    }

    protected void clear(By locator, int time) {
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                webElement(locator).clear();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }

        setStep();

    }

    protected void sendKeys(By locator, int time, String text) {
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                WebElement element = webElement(locator);
                element.sendKeys(text);

                // Verify if keys were sent correctly
                String currentValue = element.getAttribute("value");
                if (currentValue == null || currentValue.trim().isEmpty() || !currentValue.contains(text)) {
                    // If field is empty or doesn't contain expected text, clear and retry
                    element.clear();
                    element.sendKeys(text);
                    System.out.println("⚠️ SendKeys verification failed, cleared and re-inserted text");
                }
                break;
            } catch (StaleElementReferenceException e) {

            }
        }

        setStep();
    }

    /**
     * Uploads a file of FIA (Test Data → Attachments) through an {@code <input type=file>} - hidden ones
     * too, so point the locator at the input, not at the button over it.
     */
    protected void uploadAttachment(By locator, int time, String attachment) {
        new WebDriverWait(driver, Duration.ofSeconds(time)).until(ExpectedConditions.presenceOfElementLocated(locator));
        webElement(locator).sendKeys(Attachments.path(attachment));
        setStep();
    }

    public void sendKeysWithDelay(By locator, String textToType) {
        explicitWait(locator, WaitedReads.DEFAULT_SECONDS); // TICKET-989: wait for the box, not a fixed 500 ms

        // 1. Find the element
        WebElement element = webElement(locator);
        highlight(element, "type");

        // 2. Clear existing text
        element.clear();

        // 3. Build the action sequence
        Actions actions = new Actions(driver);
        actions.moveToElement(element).click(); // Focus on the field

        for (int i = 0; i < textToType.length(); i++) {
            CharSequence character = String.valueOf(textToType.charAt(i));

            // Pausing BEFORE sendKeys ensures the 10ms delay applies to the 1st char too
            actions.pause(Duration.ofMillis(100))
                    .sendKeys(character);
        }

        // 4. Perform the sequence
        actions.perform();
    }
}
