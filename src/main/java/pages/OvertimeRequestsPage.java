package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import utils.PageReady;
import utils.WaitedReads;

/** Overtime requests (/transactions/employee-overtime-requests) and the request details window. The portal runs in Arabic. */
public class OvertimeRequestsPage extends utils.MethodHandlesWeb {

    private static final String DETAILS = "//mat-dialog-container";

    private final By requestsMenu = By.xpath("//a[normalize-space()='الطلبات']");
    private final By overtimeRequestsLink = By.xpath("//a[normalize-space()='طلبات العمل الإضافي']");
    private final By reasonColumn = By.xpath("//table//th[normalize-space()='السبب']");
    private final By requestsTable = By.xpath("//table");
    private final By rejectButton = By.xpath(DETAILS + "//button[normalize-space()='رفض']");
    private final By approveButton = By.xpath(DETAILS + "//button[normalize-space()='قبول']");
    private final By closeDetailsButton = By.xpath(DETAILS + "//button[contains(@class,'btn-danger-transparent')]");
    private final By detailsStatusBadge = By.xpath(DETAILS + "//span[contains(@class,'badge')]");
    private final By decisionRows = By.xpath(DETAILS + "//div[contains(@class,'col-4')][starts-with(normalize-space(),'تم ') or starts-with(normalize-space(),'تمت ') or contains(normalize-space(),'سبب الرفض')]");
    private final By reasonInput = By.xpath("//div[contains(@class,'swal2-popup')]//input[@id='swal2-input']");
    private final By confirmButton = By.xpath("//div[contains(@class,'swal2-popup')]//button[contains(@class,'swal2-confirm')]");
    private final By cancelButton = By.xpath("//div[contains(@class,'swal2-popup')]//button[contains(@class,'swal2-cancel')]");
    private final By reasonRequiredMessage = By.id("swal2-validation-message");
    private final By successMessage = By.xpath("//*[@id='toast-container' or contains(@class,'swal2-popup') or @role='alert'][contains(normalize-space(),'تمت العملية بنجاح')]");

    public OvertimeRequestsPage(WebDriver driver) {
        super(driver);
    }

    private static By row(String reason) {
        return By.xpath("//table//tbody/tr[contains(normalize-space(),'" + reason + "')]");
    }

    private static By statusCell(String reason) {
        return By.xpath("//table//tbody/tr[contains(normalize-space(),'" + reason + "')]//td[normalize-space()='تحت الاجراء' or normalize-space()='مقبول' or normalize-space()='مرفوض']");
    }

    private static By viewButton(String reason) {
        return By.xpath("(//table//tbody/tr[contains(normalize-space(),'" + reason + "')]//app-icon[@iconname='view']/ancestor::button)[1]");
    }

    /** Side menu > Requests > Overtime requests; waits for the list. */
    public void openOvertimeRequests() {
        PageReady.open(driver, () -> {
            if (!isShownWithin(overtimeRequestsLink, 2)) {
                click(requestsMenu, 15);
            }
            click(overtimeRequestsLink, 15);
        }, reasonColumn, PageReady.SWITCH_SECONDS, "Overtime requests page");
        WaitedReads.rowsShownWithin(driver, By.xpath("//table//tbody/tr"), 15);
    }

    /** The status the list shows for the request with this reason (waits until the row shows). */
    public String listStatusOf(String reason) {
        return messageOf(statusCell(reason), 15);
    }

    /** The value of a details row, found by its label inside the details window (the list behind has a label of the same name). */
    private String detailValue(String label) {
        return messageOf(By.xpath(DETAILS + "//div[contains(@class,'col-4')][normalize-space()='" + label + "']/following-sibling::div"), 10);
    }

    /** Opens View (the eye) of the request whose reason is {@code reason}; waits for its details. */
    public void viewRequest(String reason) {
        isShownWithin(row(reason), 15);
        click(viewButton(reason), 15);
        isShownWithin(detailsStatusBadge, 15);
    }

    public String detailsStatus() {
        return detailValue("حالة الطلب");
    }

    /** The decision rows (rejected / approved by, rejection reason) the details show; 0 for a pending request. */
    public int decisionRowsShown() {
        return settledCount(decisionRows, 3);
    }

    public String rejectedBy() {
        return detailValue("تم رفض الطلب بواسطة");
    }

    public String rejectionReason() {
        return detailValue("سبب الرفض");
    }

    public void clickReject() {
        click(rejectButton, 10);
        isShownWithin(reasonInput, 10);
    }

    public void clickApprove() {
        click(approveButton, 10);
        isShownWithin(reasonInput, 10);
    }

    public void enterReasonAndConfirm(String reason) {
        clear(reasonInput, 10);
        sendKeys(reasonInput, 10, reason);
        click(confirmButton, 10);
    }

    public void confirmWithoutReason() {
        click(confirmButton, 10);
    }

    /** The "reason is required" message, waited for; "" when it never shows. */
    public String reasonRequiredMessage() {
        return messageOf(reasonRequiredMessage, 10);
    }

    /** Cancels the reason window (the request stays as it was). */
    public void cancelReasonWindow() {
        click(cancelButton, 10);
    }

    public String successMessage() {
        return messageOf(successMessage, 15);
    }

    /** Waits until the list shows {@code status} for the request with this reason; returns what it shows last. */
    public String listStatusBecomes(String reason, String status) {
        return textBecomes(statusCell(reason), status, 15);
    }

    public void closeDetails() {
        if (isShownWithin(closeDetailsButton, 2)) {
            click(closeDetailsButton, 10);
            invisibilityOf(closeDetailsButton, 10);
        }
    }
}
