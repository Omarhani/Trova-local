package utils;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.ExtentTest;
import lombok.Getter;
import lombok.Setter;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;


/**
 * The web helper API every page extends. Its members live in its parents, by job: {@link MethodHandlesWebSteps} (finding,
 * waiting, the step code), {@link MethodHandlesWebClicks}, {@link MethodHandlesWebForms} (typing, selects, alerts) and
 * {@link MethodHandlesWebReads} (reads, checks, toasts). The report fields and the assertions stay here: other helpers
 * find them on this class by name.
 */
public class MethodHandlesWeb extends MethodHandlesWebReads {

    @Setter
    @Getter
    public static String URL;


    static ExtentReports extent;
    static ExtentTest test;


    public MethodHandlesWeb(WebDriver driver) {
        super(driver);
    }

    /**
     * Opens a page and waits for its header. The whole app can hang on its loading spinner for 20 s+ on a slow
     * Test server (nothing but the spinner) - reload once and
     * wait again before failing.
     */
    protected void openPage(String url, By header) {
        driver.get(url);
        try {
            isDisplayed(header, 20);
        } catch (TimeoutException stuck) {
            System.out.println("⏳ " + url + " still loading after 20 s - reloading it once");
            driver.navigate().refresh();
            isDisplayed(header, 30);
        }
    }

    /**
     * One step of the running test, as the Timeline shows it: "5 click xpath: //button[...] button "Save"
     * LoginPage.clickSave". An assertion is a step too (action "assert", {@code passed} set, number = the
     * step it came after). {@code at} is the wall clock, so network calls can be put under their step.
     */
    public record Step(int number, String action, String locator, String element, String caller, long at,
                       Boolean passed, String detail) {
    }


    // Assertions - web, mobile and API tests all use these (see utils.ReportedAssertions for what one assertion reports and logs).
    // Give a name to say what is checked; without one the assertion is named after its line (OrdersTests:43).

    public static void myAssertEquals(Object actualResult, Object expectedResult) {
        ReportedAssertions.equals(null, actualResult, expectedResult);
    }

    /** {@code name}: what is checked, e.g. "Order details · total" - in the report, the log and the failure. */
    public static void myAssertEquals(String name, Object actualResult, Object expectedResult) {
        ReportedAssertions.equals(name, actualResult, expectedResult);
    }

    /** {@code actual} contains {@code expectedPart} - the report shows the whole actual text. */
    public static void myAssertContains(String name, String actual, String expectedPart) {
        ReportedAssertions.contains(name, actual, expectedPart);
    }

    public static void myAssertTrue(boolean condition) {
        ReportedAssertions.isTrue(null, condition);
    }

    /** {@code name}: what must be true, e.g. "Order left the list". */
    public static void myAssertTrue(String name, boolean condition) {
        ReportedAssertions.isTrue(name, condition);
    }

    public static void myAssertFalse(boolean condition) {
        ReportedAssertions.isFalse(null, condition);
    }

    /** {@code name}: what must be false. */
    public static void myAssertFalse(String name, boolean condition) {
        ReportedAssertions.isFalse(name, condition);
    }

    /**
     * Soft assertions: every assertion in {@code assertions} runs even when one fails; the test fails once at the end with all
     * failed assertions listed, and the report gets one summary table of the group. See {@link ReportedAssertions#softly}.
     */
    public static void softly(String title, Runnable assertions) {
        ReportedAssertions.softly(title, assertions);
    }
    ////////////////////////////////////////////////////////////////////////////////////////////

    /// ///////////////////////////////// confirmation dialog ///////////////////////////////////

    private final By confirmationDialogTitle = By.className("swal2-title");
    private final By acceptButton = By.xpath("//button[@class='swal2-confirm swal2-styled']");

    private final By rejectButton = By.xpath("//button[@class='swal2-cancel swal2-styled']");

    private void waitForConfirmationDialog() {
        isDisplayed(confirmationDialogTitle, 10);
    }

    public void clickAccept() {
        waitForConfirmationDialog();
        click(acceptButton, 10);
    }

    public void clickReject() {
        waitForConfirmationDialog();
        click(rejectButton, 10);
    }

    /// /////////////////////////////////////////////////////////////////////////////////////////

    public void hideElement(By locator) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            js.executeScript("arguments[0].style.display = 'none';", webElement(locator));
        } catch (Exception e) {
            System.err.println("Failed to hide element: " + e.getMessage());
        }
    }
}
