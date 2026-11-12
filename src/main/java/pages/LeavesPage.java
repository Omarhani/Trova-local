package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import utils.MethodHandlesWeb;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

/** The Leaves page (/leaves) and its "Add leave" dialog. The portal runs in Arabic; English labels are matched too. */
public class LeavesPage extends MethodHandlesWeb {

    private static final String DIALOG = "//mat-dialog-container";

    private final By leavesMenu = By.xpath("//button[contains(@class,'menu-item')][contains(normalize-space(),'المغادارات') or contains(normalize-space(),'Leaves')]");
    private final By addLeaveButton = By.xpath("//button[contains(normalize-space(),'اضافة مغادرة') or contains(normalize-space(),'Add leave') or contains(normalize-space(),'Enter new leave')]");
    private final By employeeInput = By.xpath(DIALOG + "//input[contains(@class,'mat-autocomplete-trigger')]");
    private final By firstEmployeeOption = By.xpath("(//div[contains(@class,'mat-autocomplete-panel')]//mat-option)[1]");
    private final By typeSelect = By.xpath(DIALOG + "//app-leave-type-select//mat-select");
    private final By subTypeSelect = By.xpath(DIALOG + "//mat-form-field//mat-select");
    private final By timeInputs = By.xpath(DIALOG + "//input[contains(@class,'timer-picker')]");
    private final By calendarToggles = By.xpath(DIALOG + "//button[@aria-label='Open calendar']");
    private final By nextMonth = By.xpath("//mat-calendar//button[contains(@class,'mat-calendar-next-button')]");
    private final By previousMonth = By.xpath("//mat-calendar//button[contains(@class,'mat-calendar-previous-button')]");
    private final By saveButton = By.xpath(DIALOG + "//button[contains(@class,'confirm')]");
    private final By dialog = By.xpath(DIALOG);
    private final By successToast = By.xpath("//*[@id='toast-container' or @role='alert' or contains(@class,'toast') or contains(@class,'snack')][normalize-space()]");

    public LeavesPage(WebDriver driver) {
        super(driver);
    }

    private static By option(String text) {
        return By.xpath("//mat-option[normalize-space()='" + text + "' or .//span[normalize-space()='" + text + "']]");
    }

    private static By dayCell(int day) {
        return By.xpath("//mat-calendar//td[not(contains(@class,'mat-calendar-body-disabled'))]"
                + "//div[contains(@class,'mat-calendar-body-cell-content')][normalize-space()='" + day + "']");
    }

    private final By anyRow = By.xpath("//table//tbody/tr");

    private static By rowsOf(String jobNumber) {
        return By.xpath("//table//tbody/tr[td[normalize-space()='" + jobNumber + "']]");
    }

    /** Clicks "Leaves" in the side menu (a script click: the menu item sits under the page header). */
    public void openLeaves() {
        explicitWait(leavesMenu, 20);
        ((JavascriptExecutor) driver).executeScript("arguments[0].click();", webElement(leavesMenu));
        explicitWait(addLeaveButton, 20);
    }

    /** How many rows the list shows for this job number once the list has loaded and settled. */
    public int rowsFor(String jobNumber) {
        isShownWithin(anyRow, 10);
        return settledCount(rowsOf(jobNumber), 10);
    }

    public void clickEnterNewLeave() {
        click(addLeaveButton, 15);
        explicitWait(employeeInput, 15);
    }

    /** Types the job number in the employee box (emptied first) and picks the employee it finds. */
    public void selectEmployee(String jobNumber) {
        click(employeeInput, 10);
        clear(employeeInput, 10);
        sendKeys(employeeInput, 10, jobNumber);
        click(firstEmployeeOption, 15);
    }

    public void selectType(String type, String subType) {
        click(typeSelect, 10);
        click(option(type), 10);
        if (subType != null && !subType.isBlank()) {
            click(subTypeSelect, 10);
            click(option(subType), 10);
        }
    }

    /** Picks the day in the date picker whose toggle is number {@code toggle} (1 = from, 2 = to); the calendar opens on {@code opensOn}'s month. */
    public void selectDate(int toggle, LocalDate day, LocalDate opensOn) {
        By toggleButton = By.xpath("(" + DIALOG + "//button[@aria-label='Open calendar'])[" + toggle + "]");
        click(toggleButton, 10);
        long months = ChronoUnit.MONTHS.between(YearMonth.from(opensOn), YearMonth.from(day));
        for (long i = 0; i < Math.abs(months); i++) {
            click(months > 0 ? nextMonth : previousMonth, 5);
        }
        click(dayCell(day.getDayOfMonth()), 10);
    }

    /** Sets a time ("9:00 am") when this leave type shows time boxes (an annual leave does not); true when it did. */
    public boolean selectTime(int box, String time) {
        if (time == null || time.isBlank() || time.equalsIgnoreCase("auto") || settledCount(timeInputs, 3) < box) {
            return false;
        }
        By timeInput = By.xpath("(" + DIALOG + "//input[contains(@class,'timer-picker')])[" + box + "]");
        insertTimeMovement(time, timeInput);
        return true;
    }

    public void clickSave() {
        click(saveButton, 10);
    }

    public boolean successMessageShown() {
        return isShownWithin(successToast, 10);
    }

    public void waitForDialogToClose() {
        invisibilityOf(dialog, 15);
    }

    /** Waits until the list shows {@code expected} rows for the job number. */
    public boolean waitForRows(String jobNumber, int expected) {
        return countBecomes(rowsOf(jobNumber), expected, 20) == expected;
    }
}
