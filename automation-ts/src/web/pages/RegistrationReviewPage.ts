import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

/**
 * طلبات التسجيل's row of one request and its review screen (Java PendingRequestsPage.getStatusInTable / approveRequest
 * / requestIsGone): the eye -> every department and employee group -> الموافقة على الطلب -> موافق. The departments
 * card is called الجهات or الادارات (both kept).
 */
export class RegistrationReviewPage extends WebActions {
  private readonly searchInput = By.xpath("(//input[@placeholder='بحث'])[1]");
  private readonly approveButton = By.xpath("//button[normalize-space()='الموافقة على الطلب']");
  private readonly confirmTitle = By.xpath("//*[contains(@class,'swal2-title')]");
  private readonly confirmButton = By.xpath("//button[contains(@class,'swal2-confirm')]");
  private readonly toast = By.xpath("//div[@role='alert'][normalize-space()]");

  constructor(page: Page) {
    super(page);
  }

  private row(email: string): string {
    return By.xpath("//tbody/tr[td[normalize-space()='" + email + "']]");
  }

  private statusCell(email: string): string {
    return By.xpath("//tbody/tr[td[normalize-space()='" + email + "']]/*[count(//thead//th[normalize-space()='الحالة']/preceding-sibling::th)+1]");
  }

  private viewButton(email: string): string {
    return By.xpath("//tbody/tr[td[normalize-space()='" + email + "']]//button[.//app-icon[@iconname='view']]");
  }

  private card(name: string): string {
    const other = name === 'الجهات' ? 'الادارات' : name;
    return "//div[contains(@class,'card')][.//span[text()='" + name + "' or text()='" + other + "']]";
  }

  private reviewTitle(fullName: string): string {
    return By.xpath("//h1[contains(@class,'page-title')][contains(normalize-space(),'مراجعة طلب تسجيل')][contains(.,'" + fullName + "')]");
  }

  /** searches the list ONCE by the e-mail (a second search typed into the filled box - Jenkins Test #3) and waits for its row */
  async searchByEmail(email: string): Promise<void> {
    await this.type(this.searchInput, 10, email, 'Search');
    await this.pressKey(this.searchInput, 10, 'Enter', 'Search');
    if (!(await this.isShownWithin(this.row(email), 20))) throw new Error(`${email} is not in the registration requests`);
  }

  /** the row's الحالة once it reads expected (waits up to 10 s); what it shows otherwise */
  async statusBecomes(email: string, expected: string): Promise<string> {
    return this.textBecomes(this.statusCell(email), expected, 10);
  }

  /** eye -> review screen -> every department and group ticked -> approve -> موافق; true when every row was ticked */
  async approve(email: string, fullName: string): Promise<boolean> {
    await this.click(this.viewButton(email), 10, 'Review');
    if (!(await this.isShownWithin(this.reviewTitle(fullName), 20))) throw new Error(`The review screen of ${fullName} did not open within 20 s`);
    await this.tickAll('الجهات');
    await this.tickAll('مجموعات الموظفين');
    const allTicked = (await this.countBecomes(By.xpath(this.card('الجهات') + "//tbody//mat-checkbox[not(contains(@class,'mat-checkbox-checked'))]"), 0, 5)) === 0
      && (await this.countBecomes(By.xpath(this.card('مجموعات الموظفين') + "//tbody//mat-checkbox[not(contains(@class,'mat-checkbox-checked'))]"), 0, 5)) === 0;
    await this.click(this.approveButton, 10, 'Approve the request');
    await this.isShownWithin(this.confirmTitle, 10);
    await this.click(this.confirmButton, 10, 'OK');
    return allTicked;
  }

  async toastShows(expected: string): Promise<string> {
    return this.textBecomes(this.toast, expected, 15);
  }

  /** no row with the e-mail any more, waited for on this page (it refreshes itself) */
  async requestGone(email: string, seconds: number): Promise<boolean> {
    return this.isGoneWithin(this.row(email), seconds);
  }

  /** ticks the card's header box unless every row is ticked already (a click on a ticked header unticks all) */
  private async tickAll(name: string): Promise<void> {
    const header = By.xpath(this.card(name) + '//thead//mat-checkbox');
    if (!(await this.isShownWithin(header, 10))) throw new Error(`The review screen has no ${name} list`);
    // Java selectAllOf: the header's state read at once (no wait) - a ticked header is left as it is
    if ((await this.page.locator(header).first().getAttribute('class').catch(() => ''))?.includes('mat-checkbox-checked')) return;
    await this.click(By.xpath(this.card(name) + "//thead//mat-checkbox//span[contains(@class,'mat-checkbox-inner-container')]"), 10, name);
  }
}
