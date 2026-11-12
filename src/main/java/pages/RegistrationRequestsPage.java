package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import utils.MethodHandlesWeb;
import utils.PageReady;
import utils.TestData;

/** The Registration Requests page (/pending-requests) and its "Add employee" drawer. The portal runs in Arabic; English labels are matched too. */
public class RegistrationRequestsPage extends MethodHandlesWeb {

    public static final String FIRST_NAME = "الاسم الأول";
    public static final String LAST_NAME = "الاسم الثاني";
    public static final String USER_NAME = "اسم المستخدم";
    public static final String JOB_NUMBER = "الرقم الوظيفي";

    private final By registrationRequestsLink = By.xpath("//a[normalize-space()='طلبات التسجيل' or @aria-label='طلبات التسجيل']");
    private final By addEmployeeButton = By.xpath("//*[self::button or @role='button'][normalize-space()='اضافة موظف' or @aria-label='اضافة موظف' or @value='اضافة موظف']");
    private final By departmentSelect = By.xpath("//div[normalize-space()='الادارة']//mat-select");
    private final By saveButton = By.xpath("(//button[contains(normalize-space(),'حفظ') or contains(normalize-space(),'Save')])[last()]");
    private final By successToast = By.xpath("//*[@id='toast-container' or @role='alert' or contains(@class,'toast') or contains(@class,'snack')][normalize-space()]");

    public static final String JOB_TITLE = "المسمى الوظيفي";

    private final By searchInput = By.xpath("//*[self::input or self::textarea or @role='textbox'][@aria-label='بحث' or @placeholder='بحث' or @id=//label[normalize-space()='بحث']/@for]");
    private final By showDataButton = By.xpath("//*[self::button or @role='button'][normalize-space()='إعادة عرض البيانات' or @aria-label='إعادة عرض البيانات' or @value='إعادة عرض البيانات']");
    private final By firstDepartmentOption = By.xpath("(//div[contains(@class,'mat-select-panel')]//mat-option[not(contains(@class,'contains-mat-select-search'))])[1]");
    private final By listRange = By.xpath("//div[contains(@class,'mat-paginator-range-label')]");
    private final By closeDrawerButton = By.xpath("//mat-dialog-container//button[contains(@class,'btn-danger-transparent')]");
    private final By confirmOkButton = By.xpath("//button[contains(@class,'swal2-confirm')][normalize-space()='موافق']");
    private final By confirmTitle = By.xpath("//*[contains(@class,'swal2-title')][contains(normalize-space(),'هل أنت متأكد من حذف الطلب')]");

    public RegistrationRequestsPage(WebDriver driver) {
        super(driver);
    }

    private static By input(String label) {
        return By.xpath("//*[self::input or self::textarea or @role='textbox'][@aria-label='" + label + " *' or @placeholder='" + label + " *' or @placeholder='" + label + "' or @id=//label[normalize-space()='" + label + " *']/@for]");
    }

    private static By error(String label) {
        return By.xpath("//div[label[contains(normalize-space(),'" + label + "')]]/div[contains(@class,'invalid-error')]");
    }

    private static By option(String text) {
        return By.xpath("//*[self::option or self::mat-option or @role='option'][normalize-space()='" + text + "' or @aria-label='" + text + "']");
    }

    private static By rowOf(String jobNumber) {
        return By.xpath("//*[self::tr or self::mat-row][contains(normalize-space(),'" + jobNumber + "')]");
    }

    private static By rowOfUser(String userName) {
        return By.xpath("//tr[td[normalize-space()='" + userName + "']]");
    }

    private static By rowButton(String userName, String icon) {
        return By.xpath("//tr[td[normalize-space()='" + userName + "']]//app-icon[@iconname='" + icon + "']/ancestor::button[1]");
    }

    // --- Actions ---

    public void openRegistrationRequests() {
        PageReady.open(driver, () -> click(registrationRequestsLink, 20),
                addEmployeeButton, PageReady.SWITCH_SECONDS, "Registration Requests page");
        isShownWithin(listRange, 15);
    }

    /** the total of the list ("1 - 10 من 29" = 29), read after the list has settled */
    public int listCount() {
        PageReady.await(driver, 10);
        if (!isShownWithin(listRange, 3)) return 0; // the page count label is gone when the search finds nothing
        String text = getText(listRange, 15);
        return Integer.parseInt(text.substring(text.lastIndexOf("من") + 2).trim());
    }

    /** the list total once it becomes {@code expected} (waits up to 15 s); the last value read otherwise */
    public int listCountBecomes(int expected) {
        long until = System.currentTimeMillis() + 15000;
        int count = listCount();
        while (count != expected && System.currentTimeMillis() < until) {
            PageReady.await(driver, 2);
            count = listCount();
        }
        return count;
    }

    public void searchEmployee(String userName) {
        clear(searchInput, 10);
        sendKeys(searchInput, 10, userName);
        click(showDataButton, 10);
        PageReady.await(driver, 10);
    }

    public void pickAnyExistingDepartment() {
        click(departmentSelect, 10);
        click(firstDepartmentOption, 10);
    }

    /** rows of this user name once the search settles (waits up to 15 s for exactly {@code expected}) */
    public int rowsOfUser(String userName, int expected) {
        return countBecomes(rowOfUser(userName), expected, 15);
    }

    public String rowTextOfUser(String userName) {
        return getText(rowOfUser(userName), 15);
    }

    public void clickEditEmployee(String userName) {
        click(rowButton(userName, "edit"), 15);
        explicitWait(input(FIRST_NAME), 15);
    }

    public void clickDeleteEmployee(String userName) {
        click(rowButton(userName, "delete"), 15);
    }

    public boolean deleteConfirmShown() {
        return isShownWithin(confirmTitle, 10);
    }

    public void closeDrawer() {
        click(closeDrawerButton, 10);
        isGoneWithin(closeDrawerButton, 10);
    }

    public void clickConfirmOk() {
        click(confirmOkButton, 10);
    }

    /** the field's value once it shows {@code expected} (waits up to 10 s); what it holds otherwise */
    public String fieldValueBecomes(String label, String expected) {
        return valueBecomes(input(label), expected, 10);
    }

    public void clickRegistrationRequests() {
        click(registrationRequestsLink, 20);
        explicitWait(addEmployeeButton, 20);
    }

    public void clickAddEmployee() {
        click(addEmployeeButton, 15);
        explicitWait(input(FIRST_NAME), 15);
    }

    public void insertField(String label, String value) {
        clear(input(label), 10);
        sendKeys(input(label), 10, value);
    }

    public void pressTabIn(String label) {
        pressKey(input(label), 10, Keys.TAB);
    }

    /** the message the app shows under the field once it reads {@code expected} (waits up to 10 s); else what it shows */
    public String fieldMessageShows(String label, String expected) {
        return textBecomes(error(label), expected, 10); // the app's own message box under the field (invalid-error)
    }

    /** deletes the request of this user name from the list and confirms; true once its row is gone */
    public boolean deleteEmployeeRequest(String userName) {
        searchEmployee(userName);
        if (rowsOfUser(userName, 1) == 0) return true;
        clickDeleteEmployee(userName);
        deleteConfirmShown();
        clickConfirmOk();
        return isGoneWithin(rowOfUser(userName), 15);
    }

    public void selectDepartment(String department) {
        click(departmentSelect, 10);
        click(option(department), 10);
    }

    public void clickSave() {
        click(saveButton, 10);
    }

    /** false as soon as Save shows disabled (waits up to 10 s for the form to validate); true when it stays enabled */
    public boolean saveIsEnabled() {
        return !isDisabledWithin(saveButton, 10);
    }

    public boolean fieldErrorShown(String label) {
        return isShownWithin(error(label), 10);
    }

    /** a "no error" check: gives the field 3 s to show an error, false when none shows */
    public boolean fieldErrorExists(String label) {
        return isShownWithin(error(label), 3);
    }

    public String fieldErrorText(String label) {
        return messageOf(error(label), 10);
    }

    /** the toast's message only (no close button "×") */
    public String toastText() {
        return messageOf(successToast, 15);
    }

    public boolean waitForDrawerToClose() {
        return isGoneWithin(saveButton, 15);
    }

    /** rows with this job number once the list shows the one new row (waits up to 15 s after Save) */
    public int rowsFor(String jobNumber) {
        return countBecomes(rowOf(jobNumber), 1, 15);
    }

    public String rowText(String jobNumber) {
        return getText(rowOf(jobNumber), 15);
    }
}
