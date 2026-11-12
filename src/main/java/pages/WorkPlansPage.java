package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.Rectangle;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import utils.LabelledValues;
import utils.PageReady;
import utils.Switches;

import java.time.LocalDate;

/** Work plans (خطط الدوام, /calendar-shifts) - the plan list, the shift calendar and their add / edit forms. The portal runs in Arabic. */
public class WorkPlansPage extends utils.MethodHandlesWeb {

    private static final String DIALOG = "(//mat-dialog-container)[last()]";

    private final By scheduleMenu = By.xpath("//a[normalize-space()='مواعيد الدوام']");
    private final By workPlansLink = By.xpath("//a[normalize-space()='خطط الدوام']");
    private final By pageTitle = By.xpath("//h1[normalize-space()='خطط الدوام']");
    private final By addPlanButton = By.xpath("//button[normalize-space()='إضافة خطة جديدة']");
    private final By addShiftButton = By.xpath("//button[normalize-space()='إضافة']");
    private final By nameInput = By.xpath(DIALOG + "//input[@formcontrolname='Name']");
    private final By planDialogCountrySelect = By.xpath(DIALOG + "//mat-select");
    private final By shiftPlanSelect = By.xpath(DIALOG + "//mat-select[@formcontrolname='WorkPlanID']");
    private final By shiftRepeatSelect = By.xpath(DIALOG + "//mat-select[@formcontrolname='OccurranceType']");
    private final By startDateInput = By.xpath(DIALOG + "//input[@placeholder='اختر تاريخ']");
    private final By dialogSaveButton = By.xpath(DIALOG + "//button[normalize-space()='حفظ']");
    private final By dialogCloseButton = By.xpath(DIALOG + "//button[contains(@class,'btn-danger-transparent')][.//i[contains(@class,'ri-close-line')]]");
    private final By dialogOpen = By.xpath("//mat-dialog-container");
    private final By addEmployeesButton = By.xpath(DIALOG + "//button[normalize-space()='إضافة موظفين']");
    private final By departmentPicker = By.xpath(DIALOG + "//button[contains(normalize-space(),'مختارة')]");
    private final By firstDepartmentCheckbox = By.xpath("//ngx-treeview-item[1]//input[@type='checkbox']");
    private final By addEmployeesTitle = By.xpath(DIALOG + "//*[not(*)][normalize-space()='إضافة موظفين']");
    private final By employeeSelect = By.xpath(DIALOG + "//mat-select");
    private final By firstEmployeeOption = By.xpath("(//mat-option[normalize-space()])[1]");
    private final By removeEmployeeButton = By.xpath(DIALOG + "//button[normalize-space(@title)='هل أنت متأكد من حذف الموظف ؟']");
    private final By editIcon = By.xpath(DIALOG + "//button[.//i[contains(@class,'ri-edit-line')]]");
    private final By deleteIcon = By.xpath(DIALOG + "//button[.//i[contains(@class,'ri-delete-bin-line')]]");
    private final By okButton = By.xpath("(//button[normalize-space()='موافق'])[last()]");
    private final By toast = By.xpath("//*[@id='toast-container' or @role='alert' or contains(@class,'toast') or contains(@class,'snack')][normalize-space()]");
    private final By planFilterSelect = By.xpath("(//mat-select[@multiple])[1]");
    private final By showDataButton = By.xpath("//button[normalize-space()='إعادة عرض البيانات']");
    private final By timeDial = By.xpath(DIALOG + "//div[contains(@class,'circle')]");
    private final By dialogShown = By.xpath(DIALOG);

    public WorkPlansPage(WebDriver driver) {
        super(driver);
    }

    private static By planName(String name) {
        return By.xpath("//*[not(*)][normalize-space()='" + name + "']/ancestor::div[.//button][1]");
    }

    private static By planMenuButton(String name) {
        return By.xpath("//*[not(*)][normalize-space()='" + name + "']/ancestor::div[.//button][1]//button");
    }

    private static By menuItem(String text) {
        return By.xpath("//*[@role='menuitem'][normalize-space()='" + text + "']");
    }

    private static By day(String name) {
        return By.xpath(DIALOG + "//button[contains(@class,'day-button')][starts-with(normalize-space(),'" + name + "')]");
    }

    private static By daySelected(String name) {
        return By.xpath(DIALOG + "//button[contains(@class,'day-button')][contains(@class,'selected')][starts-with(normalize-space(),'" + name + "')]");
    }

    private static By option(String text) {
        return By.xpath("//mat-option[normalize-space()='" + text + "']");
    }

    private static By timeInput(String label) {
        return By.xpath(DIALOG + "//input[@placeholder='" + label + "']");
    }

    private static By pickerNumber(String label) {
        return By.xpath(DIALOG + "//button[contains(@class,'number')][normalize-space()='" + label + "']");
    }

    private static By pickerPart(String text) {
        return By.xpath(DIALOG + "//span[contains(@class,'time')][normalize-space()='" + text + "']");
    }

    private static By pickerMinutes() {
        return By.xpath("(" + DIALOG + "//span[contains(@class,'time') and contains(@class,'fixed-font-size')])[2]");
    }

    private static By tomorrowCell(LocalDate day) {
        String d = String.valueOf(day.getDayOfMonth());
        return By.xpath("//*[@role='gridcell'][normalize-space()='" + d + "' or starts-with(normalize-space(),'" + d + " ')]");
    }

    private static By shiftInCell(LocalDate day, String title) {
        return By.xpath("(//*[@role='gridcell'][normalize-space()='" + day.getDayOfMonth() + "' or starts-with(normalize-space(),'" + day.getDayOfMonth() + " ')]"
                + "//div[contains(@class,'box-event-title')]//div[contains(concat(' ',normalize-space(@class),' '),' title ')][normalize-space()='" + title + "'])[1]");
    }

    private static By shiftTimesInCell(LocalDate day) {
        return By.xpath("//*[@role='gridcell'][normalize-space()='" + day.getDayOfMonth() + "' or starts-with(normalize-space(),'" + day.getDayOfMonth() + " ')]"
                + "//div[contains(@class,'box-event-title')]/div[contains(@class,'schedule-item')]");
    }

    /** Menu: Shift times > Work plans; waits for the page title. */
    public void openWorkPlans() {
        PageReady.open(driver, () -> {
            if (!isShownWithin(workPlansLink, 2)) click(scheduleMenu, 15);
            click(workPlansLink, 15);
        }, pageTitle, PageReady.SWITCH_SECONDS, "work plans page");
        PageReady.await(driver, PageReady.SWITCH_SECONDS);
    }

    /** Loads the page again, as a person reloading it, so what was made by API shows. */
    public void reloadWorkPlans() {
        driver.navigate().refresh();
        PageReady.section(driver, pageTitle, PageReady.SWITCH_SECONDS, "work plans page");
        PageReady.await(driver, PageReady.SWITCH_SECONDS);
    }

    // ---- plans ----

    public void clickAddPlan() {
        click(addPlanButton, 15);
        PageReady.section(driver, nameInput, 15, "add plan form");
    }

    public void enterPlanName(String name) {
        clear(nameInput, 10);
        sendKeys(nameInput, 10, name);
    }

    public void selectCountry(String country) {
        click(planDialogCountrySelect, 10);
        click(option(country), 10);
    }

    /** Sets one weekday button of the plan form on or off (reads it first, clicks only when it differs). */
    public void setDay(String name, boolean on) {
        if (isShownWithin(daySelected(name), 1) == on) return;
        click(day(name), 10);
        boolean now = on ? isShownWithin(daySelected(name), 5) : isGoneWithin(daySelected(name), 5);
        if (!now) throw new AssertionError("The day " + name + " did not turn " + (on ? "on" : "off") + " within 5 s");
    }

    public void turnOnEveryDay() {
        for (String d : new String[] {"سبت", "احد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"}) setDay(d, true);
    }

    public void clickSave() {
        click(dialogSaveButton, 10);
    }

    /** The toast text once it shows (the expected one is waited for); "" when none came. */
    public String toastShows(String expected) {
        return textBecomes(toast, expected, 15);
    }

    /** Waits until the toast has gone, so the next one is not confused with it. */
    public boolean toastGone() {
        return isGoneWithin(toast, 15);
    }

    public boolean planShown(String name) {
        return isShownWithin(planName(name), 15);
    }

    public boolean planGone(String name) {
        return isGoneWithin(planName(name), 15);
    }

    public void clickPlanMenuItem(String planName, String item) {
        click(planMenuButton(planName), 10);
        click(menuItem(item), 10);
    }

    /** Confirms the question that opens after Delete. */
    public void confirmDialog() {
        click(okButton, 10);
    }

    // ---- shifts ----

    public void clickAddShift() {
        click(addShiftButton, 15);
        PageReady.section(driver, nameInput, 15, "add shift form");
    }

    public void enterShiftTitle(String title) {
        clear(nameInput, 10);
        sendKeys(nameInput, 10, title);
    }

    public void selectShiftPlan(String planName) {
        click(shiftPlanSelect, 10);
        click(option(planName), 10);
    }

    public void selectRepeat(String repeat) {
        String label = "daily".equalsIgnoreCase(repeat) ? "يومي" : repeat;
        click(shiftRepeatSelect, 10);
        click(option(label), 10);
    }

    /** The start date as the form shows it, digits and slashes only ("31/10/2026"). */
    public String startDateShown() {
        isShownWithin(startDateInput, 10);
        String v = webElement(startDateInput).getAttribute("value");
        return v == null ? "" : v.replaceAll("[^0-9/]", "");
    }

    public static String formatted(LocalDate day) {
        return String.format("%02d/%02d/%d", day.getDayOfMonth(), day.getMonthValue(), day.getYear());
    }

    /** The start date the form shows, as a date ("9/11/2026" and "09/11/2026" are the same day); null when it is not a date. */
    public LocalDate startDayShown() {
        String[] p = startDateShown().split("/");
        if (p.length != 3) return null;
        try {
            return LocalDate.of(Integer.parseInt(p[2]), Integer.parseInt(p[1]), Integer.parseInt(p[0]));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Picks the start day: the form already shows it by default, otherwise this fails in plain words. */
    public void chooseStartDate(LocalDate day) {
        String want = formatted(day);
        if (!day.equals(startDayShown())) { // 2026-11-08 run 492: the app writes 9/11/2026, no leading zero
            throw new AssertionError("The start date shows " + startDateShown() + " and cannot be changed to " + want + " here");
        }
    }

    /** Sets a time field ("10:00 am", "6 pm") through its clock: hour, minutes, AM / PM, save. */
    public void chooseTime(String label, String time) {
        String t = time.trim().toLowerCase();
        String period = t.endsWith("pm") ? "PM" : "AM";
        String[] hm = t.replaceAll("[a-z\\s]", "").split(":");
        int hour = Integer.parseInt(hm[0]);
        int minute = hm.length > 1 ? Integer.parseInt(hm[1]) : 0;
        String hourLabel = String.valueOf(hour == 0 ? 12 : hour > 12 ? hour - 12 : hour);
        String minuteLabel = minute == 0 ? "00" : String.valueOf(minute);
        click(timeInput(label), 10);
        isShownWithin(timeDial, 10);
        clickDial(pickerNumber(hourLabel));
        click(pickerMinutes(), 10);
        clickDial(pickerNumber(minuteLabel));
        click(pickerPart(period), 10);
        click(dialogSaveButton, 10);
        String shown = valueBecomes(timeInput(label), expectedTime(hourLabel, minute, period), 10);
        if (!shown.equals(expectedTime(hourLabel, minute, period))) {
            throw new AssertionError("The field " + label + " shows \"" + shown + "\" and not \"" + expectedTime(hourLabel, minute, period) + "\"");
        }
    }

    private static String expectedTime(String hour, int minute, String period) {
        return String.format("%d:%02d %s", Integer.parseInt(hour), minute, period.toLowerCase());
    }

    /** The clock takes a click on its face: click the face at the place of the number. */
    private void clickDial(By number) {
        isShownWithin(number, 10);
        WebElement face = webElement(timeDial);
        Rectangle f = face.getRect();
        Rectangle n = webElement(number).getRect();
        int dx = (n.x + n.width / 2) - (f.x + f.width / 2);
        int dy = (n.y + n.height / 2) - (f.y + f.height / 2);
        new Actions(driver).moveToElement(face, dx, dy).click().perform();
    }

    /** In the add-employees window of the open shift form: the main department and its first employee, then Save. */
    public void addAnyEmployee() {
        click(addEmployeesButton, 10);
        PageReady.section(driver, departmentPicker, 15, "add employees window");
        click(departmentPicker, 10);
        Switches.set(driver, firstDepartmentCheckbox, true, 10, "department");
        click(addEmployeesTitle, 10);
        click(employeeSelect, 10);
        click(firstEmployeeOption, 10);
        escapeButton();
        click(dialogSaveButton, 10);
    }

    public void removeEmployee() {
        click(removeEmployeeButton, 10);
    }

    /** Saves the shift form; the "OK" question that follows an edit is confirmed. */
    public void saveShift() {
        click(dialogSaveButton, 10);
    }

    public void confirmEditQuestion() {
        if (isShownWithin(okButton, 5)) click(okButton, 10);
    }

    public void openShiftDetails(LocalDate day, String title) {
        click(shiftInCell(day, title), 15);
        PageReady.section(driver, deleteIcon, 15, "shift details");
    }

    /** A value of the shift's details by its label ("بداية الدوام" → "10:00"). */
    public String detail(String label) {
        return LabelledValues.byLabel(driver, 10, label);
    }

    public void clickEditIcon() {
        click(editIcon, 10);
        PageReady.section(driver, nameInput, 15, "edit shift form");
    }

    public void clickDeleteIcon() {
        click(deleteIcon, 10);
    }

    public void chooseDeleteScope(String scope) {
        click(By.xpath("//*[not(*)][normalize-space()='" + scope + "']"), 10);
    }

    public boolean shiftShown(LocalDate day, String title) {
        return isShownWithin(shiftInCell(day, title), 15);
    }

    public boolean shiftGone(LocalDate day, String title) {
        return isGoneWithin(shiftInCell(day, title), 15);
    }

    /** Filters the calendar by one plan. */
    public void filterByPlan(String planName) {
        click(planFilterSelect, 10);
        click(option(planName), 10);
        escapeButton();
        click(showDataButton, 10);
        PageReady.await(driver, PageReady.SWITCH_SECONDS);
    }

    /** The number of shifts the day's cell shows once it settles on {@code expected}. */
    public int shiftsOnDay(LocalDate day, int expected) {
        return countBecomes(shiftTimesInCell(day), expected, 15);
    }

    public void closeDialog() {
        escapeButton();
        if (!isGoneWithin(dialogShown, 3)) click(dialogCloseButton, 10);
    }

    public boolean dialogClosed() {
        return isGoneWithin(dialogOpen, 10);
    }
}
