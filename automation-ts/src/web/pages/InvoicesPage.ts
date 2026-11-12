import { Page } from '@playwright/test';
import { testData } from '../../run/testData';
import { By } from '../by';
import { pageOpens } from '../pageOpening';
import { WebActions } from '../webActions';

const FORM = "//*[@role='dialog'][@aria-label='فاتورة جديدة']";

/** Invoices (/invoices) - the invoice list and its "New invoice" drawer. The app runs in Arabic. */
export class InvoicesPage extends WebActions {
  private readonly pageTitle = By.xpath("//h1[normalize-space()='الفواتير']");
  private readonly newInvoiceButton = By.xpath("//button[normalize-space()='فاتورة جديدة']");
  private readonly form = By.xpath(FORM);
  private readonly customerPicker = By.xpath(FORM + "//button[contains(@class,'scd-select__trigger')]");
  private readonly customerSearch = By.xpath(FORM + "//input[@placeholder='ابحث بالاسم أو الكود أو الهاتف…']");
  private readonly itemPicker = By.xpath(FORM + "//button[contains(@class,'scd-pick__trigger')]");
  private readonly itemSearch = By.xpath(FORM + "//input[@placeholder='ابحث بالاسم أو الكود أو الباركود']");
  private readonly useAsFreeText = By.xpath(FORM + "//button[contains(normalize-space(),'كوصف حر')]");
  private readonly quantityInput = By.xpath(FORM + "//input[@formcontrolname='quantity']");
  private readonly unitPriceInput = By.xpath(FORM + "//input[@formcontrolname='unitPrice']");
  private readonly notesInput = By.id('iNotes');
  private readonly finalTotal = By.xpath(FORM + "//*[normalize-space()='الإجمالي النهائي']/following-sibling::strong");
  private readonly saveButton = By.xpath(FORM + "//button[@type='submit'][normalize-space()='حفظ الفاتورة']");
  private readonly createdToast = By.xpath("//*[not(*)][starts-with(normalize-space(),'رقم ')][contains(normalize-space(),'بمبلغ')]");

  constructor(page: Page) {
    super(page);
  }

  private customerOption(customer: string): string {
    return By.xpath(FORM + "//li[@role='option'][contains(normalize-space(),'" + customer + "')]");
  }

  private row(number: string): string {
    return By.xpath("//table//tbody/tr[td[1][normalize-space()='" + number + "']]");
  }

  /** opens /invoices and waits for its title */
  async openInvoices(): Promise<void> {
    await pageOpens(this.page, 'The Invoices page', 20, async () => {
      await this.page.goto(testData.webUrl().replace(/\/+$/, '') + '/invoices', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return this.isShownWithin(this.pageTitle, 20);
    });
  }

  async clickNewInvoice(): Promise<void> {
    await this.click(this.newInvoiceButton, 15, 'New invoice');
    await this.isShownWithin(this.form, 10);
  }

  /** picks the customer by a part of its name or code (searched first) */
  async chooseCustomer(customer: string): Promise<void> {
    await this.click(this.customerPicker, 10, 'Customer');
    await this.type(this.customerSearch, 10, customer, 'Customer search');
    await this.click(this.customerOption(customer), 15, customer);
  }

  /** first invoice line as a free description (no product, so no stock moves) */
  async enterFreeTextItem(description: string, quantity: string, unitPrice: string): Promise<void> {
    await this.click(this.itemPicker, 10, 'Item');
    await this.type(this.itemSearch, 10, description, 'Item search');
    await this.click(this.useAsFreeText, 15, 'Use as free text');
    await this.type(this.quantityInput, 10, quantity, 'Quantity');
    await this.type(this.unitPriceInput, 10, unitPrice, 'Unit price');
  }

  async enterNotes(notes: string): Promise<void> {
    await this.type(this.notesInput, 10, notes, 'Notes');
  }

  /** "150.00 جنيه" as the form shows it once expected is reached; the last text seen otherwise */
  async finalTotalShows(expected: string): Promise<string> {
    return this.textBecomes(this.finalTotal, expected, 10);
  }

  async clickSave(): Promise<void> {
    await this.click(this.saveButton, 10, 'Save invoice');
  }

  /** "رقم 2026056 بمبلغ 150.00 EGP" - the message after saving */
  /** the "invoice number ... amount" message shown since the click (Save), waited up to 15 s; "" when none came */
  async createdToastText(): Promise<string> {
    return this.firstToastAfterAction(this.createdToast, 15, (t) => t.startsWith('رقم ') && t.includes('بمبلغ'));
  }

  async formClosed(): Promise<boolean> {
    return this.isGoneWithin(this.form, 10);
  }

  /** the list row of this invoice number as one line of text ("" when it is not on the first page) */
  async rowText(number: string): Promise<string> {
    if (!(await this.isShownWithin(this.row(number), 15))) return '';
    return (await this.textOf(this.row(number), 10)).replace(/\s+/g, ' ');
  }
}
