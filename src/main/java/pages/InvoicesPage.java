package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import utils.PageReady;

/** Invoices (/invoices) - the invoice list and its "New invoice" drawer. The app runs in Arabic. */
public class InvoicesPage extends utils.MethodHandlesWeb {

    private static final String FORM = "//*[@role='dialog'][@aria-label='فاتورة جديدة']";

    private final By pageTitle = By.xpath("//h1[normalize-space()='الفواتير']");
    private final By newInvoiceButton = By.xpath("//button[normalize-space()='فاتورة جديدة']");
    private final By form = By.xpath(FORM);
    private final By customerPicker = By.xpath(FORM + "//button[contains(@class,'scd-select__trigger')]");
    private final By customerSearch = By.xpath(FORM + "//input[@placeholder='ابحث بالاسم أو الكود أو الهاتف…']");
    private final By itemPicker = By.xpath(FORM + "//button[contains(@class,'scd-pick__trigger')]");
    private final By itemSearch = By.xpath(FORM + "//input[@placeholder='ابحث بالاسم أو الكود أو الباركود']");
    private final By useAsFreeText = By.xpath(FORM + "//button[contains(normalize-space(),'كوصف حر')]");
    private final By quantityInput = By.xpath(FORM + "//input[@formcontrolname='quantity']");
    private final By unitPriceInput = By.xpath(FORM + "//input[@formcontrolname='unitPrice']");
    private final By notesInput = By.id("iNotes");
    private final By finalTotal = By.xpath(FORM + "//*[normalize-space()='الإجمالي النهائي']/following-sibling::strong");
    private final By saveButton = By.xpath(FORM + "//button[@type='submit'][normalize-space()='حفظ الفاتورة']");
    private final By createdToast = By.xpath("//*[not(*)][starts-with(normalize-space(),'رقم ')][contains(normalize-space(),'بمبلغ')]");

    public InvoicesPage(WebDriver driver) {
        super(driver);
    }

    private static By customerOption(String customer) {
        return By.xpath(FORM + "//li[@role='option'][contains(normalize-space(),'" + customer + "')]");
    }

    private static By row(String number) {
        return By.xpath("//table//tbody/tr[td[1][normalize-space()='" + number + "']]");
    }

    /** Opens /invoices and waits for its title. */
    public void openInvoices() {
        PageReady.open(driver, () -> driver.navigate().to(utils.TestData.webUrl().replaceAll("/+$", "") + "/invoices"),
                pageTitle, PageReady.SWITCH_SECONDS, "Invoices page");
    }

    public void clickNewInvoice() {
        click(newInvoiceButton, 15);
        isShownWithin(form, 10);
    }

    /** Picks the customer by a part of its name or code (searched first). */
    public void chooseCustomer(String customer) {
        click(customerPicker, 10);
        clear(customerSearch, 10);
        sendKeys(customerSearch, 10, customer);
        click(customerOption(customer), 15);
    }

    /** First invoice line as a free description (no product, so no stock moves). */
    public void enterFreeTextItem(String description, String quantity, String unitPrice) {
        click(itemPicker, 10);
        clear(itemSearch, 10);
        sendKeys(itemSearch, 10, description);
        click(useAsFreeText, 15);
        clear(quantityInput, 10);
        sendKeys(quantityInput, 10, quantity);
        clear(unitPriceInput, 10);
        sendKeys(unitPriceInput, 10, unitPrice);
    }

    public void enterNotes(String notes) {
        clear(notesInput, 10);
        sendKeys(notesInput, 10, notes);
    }

    /** "150.00 جنيه" as the form shows it once {@code expected} is reached ("" when it never is). */
    public String finalTotalShows(String expected) {
        return textBecomes(finalTotal, expected, 10);
    }

    public void clickSave() {
        click(saveButton, 10);
    }

    /** "رقم 2026056 بمبلغ 150.00 EGP" - the toast after saving ("" when none shows). */
    public String createdToastText() {
        return messageOf(createdToast, 15);
    }

    public boolean formClosed() {
        return isGoneWithin(form, 10);
    }

    /** The list row of this invoice number, as one line of text ("" when it is not on the first page). */
    public String rowText(String number) {
        return isShownWithin(row(number), 15) ? getText(row(number), 10).replaceAll("\\s+", " ") : "";
    }
}
