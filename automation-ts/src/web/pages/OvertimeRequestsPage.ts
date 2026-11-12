import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';
import { pageOpens } from '../pageOpening';

const DETAILS = '//mat-dialog-container';

/** Overtime requests (/transactions/employee-overtime-requests) and the request details window. The portal runs in Arabic. */
export class OvertimeRequestsPage extends WebActions {
  private readonly requestsMenu = By.xpath("//a[normalize-space()='الطلبات']");
  private readonly overtimeRequestsLink = By.xpath("//a[normalize-space()='طلبات العمل الإضافي']");
  private readonly reasonColumn = By.xpath("//table//th[normalize-space()='السبب']");
  private readonly tableRows = By.xpath('//table//tbody/tr');
  private readonly rejectButton = By.xpath(DETAILS + "//button[normalize-space()='رفض']");
  private readonly approveButton = By.xpath(DETAILS + "//button[normalize-space()='قبول']");
  private readonly closeDetailsButton = By.xpath(DETAILS + "//button[contains(@class,'btn-danger-transparent')]");
  private readonly detailsStatusBadge = By.xpath(DETAILS + "//span[contains(@class,'badge')]");
  private readonly decisionRows = By.xpath(DETAILS + "//div[contains(@class,'col-4')][starts-with(normalize-space(),'تم ') or starts-with(normalize-space(),'تمت ') or contains(normalize-space(),'سبب الرفض')]");
  private readonly reasonInput = By.xpath("//div[contains(@class,'swal2-popup')]//input[@id='swal2-input']");
  private readonly confirmButton = By.xpath("//div[contains(@class,'swal2-popup')]//button[contains(@class,'swal2-confirm')]");
  private readonly cancelButton = By.xpath("//div[contains(@class,'swal2-popup')]//button[contains(@class,'swal2-cancel')]");
  private readonly reasonRequiredBox = By.id('swal2-validation-message');
  private readonly successBox = By.xpath("//*[@id='toast-container' or contains(@class,'swal2-popup') or @role='alert'][contains(normalize-space(),'تمت العملية بنجاح')]");

  constructor(page: Page) {
    super(page);
  }

  private row(reason: string): string {
    return By.xpath("//table//tbody/tr[contains(normalize-space(),'" + reason + "')]");
  }

  private statusCell(reason: string): string {
    return By.xpath("//table//tbody/tr[contains(normalize-space(),'" + reason + "')]//td[normalize-space()='تحت الاجراء' or normalize-space()='مقبول' or normalize-space()='مرفوض']");
  }

  private viewButton(reason: string): string {
    return By.xpath("(//table//tbody/tr[contains(normalize-space(),'" + reason + "')]//app-icon[@iconname='view']/ancestor::button)[1]");
  }

  /** a details row's value, found by its label inside the details window (the list behind has a label of the same name) */
  private detailValue(label: string): Promise<string> {
    return this.messageOf(By.xpath(DETAILS + "//div[contains(@class,'col-4')][normalize-space()='" + label + "']/following-sibling::div"), 10);
  }

  /** side menu > Requests > Overtime requests; waits for the list */
  async openOvertimeRequests(): Promise<void> {
    await pageOpens(this.page, 'The Overtime requests page', 20, async () => {
      if (!(await this.isShownWithin(this.overtimeRequestsLink, 2))) await this.click(this.requestsMenu, 15, 'Requests');
      await this.click(this.overtimeRequestsLink, 15, 'Overtime requests');
      return this.isShownWithin(this.reasonColumn, 20);
    });
    await this.rowsShownWithin(this.tableRows, 15);
  }

  /** the status the list shows for the request with this reason (waits until the row shows) */
  async listStatusOf(reason: string): Promise<string> {
    return this.messageOf(this.statusCell(reason), 15);
  }

  /** opens View (the eye) of the request with this reason; waits for its details */
  async viewRequest(reason: string): Promise<void> {
    await this.isShownWithin(this.row(reason), 15);
    await this.click(this.viewButton(reason), 15, 'View');
    await this.isShownWithin(this.detailsStatusBadge, 15);
  }

  async detailsStatus(): Promise<string> {
    return this.detailValue('حالة الطلب');
  }

  /** the decision rows (rejected / approved by, rejection reason) the details show; 0 for a pending request */
  async decisionRowsShown(): Promise<number> {
    return this.settledCount(this.decisionRows, 3);
  }

  async rejectedBy(): Promise<string> {
    return this.detailValue('تم رفض الطلب بواسطة');
  }

  async rejectionReason(): Promise<string> {
    return this.detailValue('سبب الرفض');
  }

  async clickReject(): Promise<void> {
    await this.click(this.rejectButton, 10, 'Reject');
    await this.isShownWithin(this.reasonInput, 10);
  }

  async clickApprove(): Promise<void> {
    await this.click(this.approveButton, 10, 'Approve');
    await this.isShownWithin(this.reasonInput, 10);
  }

  async enterReasonAndConfirm(reason: string): Promise<void> {
    await this.type(this.reasonInput, 10, reason, 'Reason');
    await this.click(this.confirmButton, 10, 'Confirm');
  }

  async confirmWithoutReason(): Promise<void> {
    await this.click(this.confirmButton, 10, 'Confirm');
  }

  /** the "reason is required" message, waited for; "" when it never shows */
  async reasonRequiredMessage(): Promise<string> {
    return this.messageOf(this.reasonRequiredBox, 10);
  }

  /** cancels the reason window (the request stays as it was) */
  async cancelReasonWindow(): Promise<void> {
    await this.click(this.cancelButton, 10, 'Cancel');
  }

  async successMessage(): Promise<string> {
    return this.messageOf(this.successBox, 15);
  }

  /** waits until the list shows status for the request with this reason; what it shows last */
  async listStatusBecomes(reason: string, status: string): Promise<string> {
    return this.textBecomes(this.statusCell(reason), status, 15);
  }

  async closeDetails(): Promise<void> {
    if (!(await this.isShownWithin(this.closeDetailsButton, 2))) return;
    await this.click(this.closeDetailsButton, 10, 'Close');
    await this.isGoneWithin(this.closeDetailsButton, 10);
  }
}
