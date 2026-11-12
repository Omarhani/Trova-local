package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import utils.PageReady;
import utils.Switches;

/** Account settings (/account/settings) - the Attendance settings card "Overtime". The portal runs in Arabic. */
public class OvertimeSettingsPage extends utils.MethodHandlesWeb {

    private final By profileMenu = By.xpath("//a[.//img[@alt='profile']]");
    private final By changeAccountInformationButton = By.xpath("//button[normalize-space()='تغيير معلومات الحساب']");
    private final By attendanceSettingsLink = By.xpath("//a[normalize-space()='إعدادات الحضور و الانصراف']");
    private final By overtimeCardHeader = By.xpath("//div[contains(@class,'card-header')][.//span[normalize-space()='العمل الإضافي']]");
    private final By overtimeSwitch = By.id("isExtraWork");
    private final By monthlyBalanceInput = By.id("OvertimeRequestMonthlyBalanceHours");
    private final By minimumHoursInput = By.id("MinimumExtraHours");
    private final By maximumHoursInput = By.id("MaximumExtraHours");
    private final By monthlyBalanceLabel = By.xpath("//label[normalize-space()='رصيد طلبات العمل الإضافي (ساعات) شهري'] | //*[not(*)][normalize-space()='رصيد طلبات العمل الإضافي (ساعات) شهري']");
    private final By emptyMeansNoLimitHint = By.xpath("//*[not(*)][contains(normalize-space(),'اتركه فارغاً للسماح بالطلبات دون حد أقصى')]");
    private final By saveButton = By.xpath("//button[normalize-space()='حفظ']");

    public OvertimeSettingsPage(WebDriver driver) {
        super(driver);
    }

    private static By messageWith(String text) {
        return By.xpath("//*[contains(@class,'invalid-error')][contains(normalize-space(),'" + text + "')]");
    }

    /** User menu > Change account information; waits for the settings page. */
    public void openChangeAccountInformation() {
        PageReady.open(driver, () -> {
            click(profileMenu, 15);
            click(changeAccountInformationButton, 15);
        }, attendanceSettingsLink, PageReady.SWITCH_SECONDS, "account settings page");
    }

    /** Opens the Attendance settings card and its Overtime part (opened once: a second click would fold it). */
    public void openOvertimeSettings() {
        click(attendanceSettingsLink, 15);
        PageReady.await(driver, PageReady.SWITCH_SECONDS);
        if (!isShownWithin(overtimeSwitch, 3)) {
            click(overtimeCardHeader, 15);
        }
        PageReady.section(driver, overtimeSwitch, PageReady.SWITCH_SECONDS, "Overtime section");
    }

    /** Sets the Overtime switch on (reads it first, clicks only when it is off). */
    public void turnOvertimeOn() {
        Switches.set(driver, overtimeSwitch, true, 10, "Overtime");
    }

    public boolean monthlyBalanceFieldShown() {
        return isShownWithin(monthlyBalanceInput, 10) && isShownWithin(monthlyBalanceLabel, 10);
    }

    public boolean emptyMeansNoLimitShown() {
        return isShownWithin(emptyMeansNoLimitHint, 10);
    }

    public void enterMonthlyBalance(String hours) {
        clear(monthlyBalanceInput, 10);
        sendKeys(monthlyBalanceInput, 10, hours);
    }

    public void setMinimumDailyOvertime(String hours) {
        clear(minimumHoursInput, 10);
        sendKeys(minimumHoursInput, 10, hours);
    }

    public void setMaximumDailyOvertime(String hours) {
        clear(maximumHoursInput, 10);
        sendKeys(maximumHoursInput, 10, hours);
    }

    /** Clicks Save; the app greys Save out while a value is refused, then there is nothing to click and the message says why. */
    public void clickSave() {
        if (isEnabledWithin(saveButton, 3)) {
            click(saveButton, 10);
        }
    }

    /** The message under the fields once it shows ("" when it never does); {@code expected} is the text the app should show. */
    public String messageShows(String expected) {
        return textBecomes(messageWith(expected.replace(".", "").trim()), expected, 10);
    }

    /** Any validation message under the fields, waited for briefly; "" when none shows. */
    public String anyMessage() {
        return messageOf(By.xpath("//*[contains(@class,'invalid-error')][normalize-space()!='']"), 4);
    }

    public String monthlyBalanceValue() {
        return valueOf(monthlyBalanceInput);
    }

    public String minimumHoursValue() {
        return valueOf(minimumHoursInput);
    }

    public String maximumHoursValue() {
        return valueOf(maximumHoursInput);
    }

    private String valueOf(By field) {
        isShownWithin(field, 10);
        String v = webElement(field).getAttribute("value");
        return v == null ? "" : v;
    }

    /** Opens the settings again from the page's address, as a person reloading it, and shows the Overtime part. */
    public void reopenOvertimeSettings() {
        driver.navigate().refresh();
        PageReady.section(driver, attendanceSettingsLink, PageReady.SWITCH_SECONDS, "account settings page");
        openOvertimeSettings();
    }
}
