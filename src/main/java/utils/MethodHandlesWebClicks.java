package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/** Clicks, hovers and drags of {@link MethodHandlesWeb}. */
public class MethodHandlesWebClicks extends MethodHandlesWebSteps {

    public MethodHandlesWebClicks(WebDriver driver) {
        super(driver);
    }

    protected void clickWithActions(By locator, int time) {
        actions = new Actions(driver);
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                actions.click(webElement(locator)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();

    }


    /**
     * Simplified version of robust click - good for most cases
     * Combines Actions and JavaScript click strategies
     */
    protected void smartClick(By locator, int time) {
        boolean clicked = false;

        try {
            // First try: Actions click with enhanced waiting
            wait = new WebDriverWait(driver, Duration.ofSeconds(time));
            WebElement element = wait.until(ExpectedConditions.elementToBeClickable(locator));

            // Scroll and highlight
            scrollIntoElement(element);
            addBorderToElement(driver, element);

            // Actions click
            actions = new Actions(driver);
            actions.moveToElement(element).pause(Duration.ofMillis(200)).click().build().perform();

            clicked = true;
            System.out.println("✅ Smart click successful (Actions)");

        } catch (Exception e) {
            try {
                // Fallback: JavaScript click
                System.out.println("🔄 Smart click fallback to JavaScript: " + e.getClass().getSimpleName());
                WebElement element = driver.findElement(locator);
                ((JavascriptExecutor) driver).executeScript("arguments[0].click();", element);
                clicked = true;
                System.out.println("✅ Smart click successful (JavaScript)");

            } catch (Exception e2) {
                System.out.println("❌ Smart click failed: " + e2.getClass().getSimpleName());
                throw new RuntimeException("Smart click failed for locator: " + locator.toString(), e2);
            }
        }

        setStep();
    }

    protected void doubleClick(By locator, int time) {
        actions = new Actions(driver);
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                actions.doubleClick(webElement(locator)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
    }

    protected void contextClick(By locator, int time) {
        actions = new Actions(driver);
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                actions.contextClick(webElement(locator)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();

    }

    protected void clickAndHold(By locator, int time) {
        actions = new Actions(driver);

        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                actions.clickAndHold(webElement(locator)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }

        setStep();

    }

    protected void escapeButton() {
        actions = new Actions(driver);
        actions.sendKeys(Keys.ESCAPE).build().perform();
    }

    protected void moveToElement(By locator, int time) {
        actions = new Actions(driver);
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                actions.moveToElement(webElement(locator)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
    }

    protected void dragAndDrop(By src, By target, int time) {
        actions = new Actions(driver);
        explicitWait(src, time);
        explicitWait(target, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(src));
                addBorderToElement(driver, webElement(src));
                scrollIntoElement(webElement(target));
                addBorderToElement(driver, webElement(target));
                actions.dragAndDrop(webElement(src), webElement(target)).build().perform();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();

    }

    protected void release(By locator, int time) {
        actions = new Actions(driver);
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();

    }

    protected void release(int time) {
        actions = new Actions(driver);
        actions.release().build().perform();
        setStep();

    }
    protected void scrollToElementInModal(By locator) {
        JavascriptExecutor js = (JavascriptExecutor) driver;

        // Executes JavaScript to scroll the inner container instead of the main window
        js.executeScript(
                "arguments[0].scrollIntoView({" +
                        "  behavior: 'smooth'," +
                        "  block: 'center'," +
                        "  inline: 'center'" +
                        "});",
                webElement(locator)
        );
    }

    protected void click(By locator, int time) {
        explicitWait(locator, time);
        // Omar 2026-10-25: still stale after 5 tries, or covered / not clickable = AI help, then once more (never a silent pass)
        SignedOutStep.act(driver, () -> {
            StaleElementReferenceException last = null;
            for (int i = 0; i < 5; i++) {
                try {
                    scrollIntoElement(webElement(locator));
                    addBorderToElement(driver, webElement(locator));
                    webElement(locator).click();
                    return;
                } catch (StaleElementReferenceException e) {
                    last = e;
                }
            }
            throw last;
        });

        setStep();

    }

    protected void submit(By locator, int time) {
        explicitWait(locator, time);
        for (int i = 0; i < 5; i++) {
            try {
                scrollIntoElement(webElement(locator));
                addBorderToElement(driver, webElement(locator));
                webElement(locator).submit();
                break;
            } catch (StaleElementReferenceException e) {

            }
        }
        setStep();
    }
}
