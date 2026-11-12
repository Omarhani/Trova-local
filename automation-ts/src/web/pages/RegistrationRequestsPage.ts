import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

/** The Registration Requests page (/pending-requests) and its "Add employee" drawer. The portal runs in Arabic. */
export class RegistrationRequestsPage extends WebActions {
  static readonly FIRST_NAME = 'الاسم الأول';
  static readonly LAST_NAME = 'الاسم الثاني';
  static readonly USER_NAME = 'اسم المستخدم';
  static readonly JOB_NUMBER = 'الرقم الوظيفي';
  static readonly JOB_TITLE = 'المسمى الوظيفي';

  private readonly registrationRequestsLink = By.xpath("//a[normalize-space()='طلبات التسجيل' or @aria-label='طلبات التسجيل']");
  private readonly addEmployeeButton = By.xpath("//*[self::button or @role='button'][normalize-space()='اضافة موظف' or @aria-label='اضافة موظف' or @value='اضافة موظف']");
  private readonly departmentSelect = By.xpath("//div[normalize-space()='الادارة']//mat-select");
  private readonly saveButton = By.xpath("(//button[contains(normalize-space(),'حفظ') or contains(normalize-space(),'Save')])[last()]");
  private readonly successToast = By.xpath("//*[@id='toast-container' or @role='alert' or contains(@class,'toast') or contains(@class,'snack')][normalize-space()]");
  private readonly searchInput = By.xpath("//*[self::input or self::textarea or @role='textbox'][@aria-label='بحث' or @placeholder='بحث' or @id=//label[normalize-space()='بحث']/@for]");
  private readonly showDataButton = By.xpath("//*[self::button or @role='button'][normalize-space()='إعادة عرض البيانات' or @aria-label='إعادة عرض البيانات' or @value='إعادة عرض البيانات']");
  private readonly firstDepartmentOption = By.xpath("(//div[contains(@class,'mat-select-panel')]//mat-option[not(contains(@class,'contains-mat-select-search'))])[1]");
  private readonly listRange = By.xpath("//div[contains(@class,'mat-paginator-range-label')]");
  private readonly closeDrawerButton = By.xpath("//mat-dialog-container//button[contains(@class,'btn-danger-transparent')]");
  private readonly confirmOkButton = By.xpath("//button[contains(@class,'swal2-confirm')][normalize-space()='موافق']");
  private readonly confirmTitle = By.xpath("//*[contains(@class,'swal2-title')][contains(normalize-space(),'هل أنت متأكد من حذف الطلب')]");

  constructor(page: Page) {
    super(page);
  }

  private input(label: string): string {
    return By.xpath("//*[self::input or self::textarea or @role='textbox'][@aria-label='" + label + " *' or @placeholder='" + label + " *' or @placeholder='" + label + "' or @id=//label[normalize-space()='" + label + " *']/@for]");
  }

  private error(label: string): string {
    return By.xpath("//div[label[contains(normalize-space(),'" + label + "')]]/div[contains(@class,'invalid-error')]");
  }

  private option(text: string): string {
    return By.xpath("//*[self::option or self::mat-option or @role='option'][normalize-space()='" + text + "' or @aria-label='" + text + "']");
  }

  private rowOf(jobNumber: string): string {
    return By.xpath("//*[self::tr or self::mat-row][contains(normalize-space(),'" + jobNumber + "')]");
  }

  private rowButton(userName: string, icon: string): string {
    return By.xpath("//tr[td[normalize-space()='" + userName + "']]//app-icon[@iconname='" + icon + "']/ancestor::button[1]");
  }

  private rowOfUser(userName: string): string {
    return By.xpath("//tr[td[normalize-space()='" + userName + "']]");
  }

  async openRegistrationRequests(): Promise<void> {
    await this.click(this.registrationRequestsLink, 20, 'Registration Requests');
    await this.isShownWithin(this.addEmployeeButton, 20);
    await this.isShownWithin(this.listRange, 15);
  }

  /** the total of the list ("1 - 10 من 29" = 29), read after the list has settled */
  async listCount(): Promise<number> {
    await this.settled(10);
    if (!(await this.isShownWithin(this.listRange, 3))) return 0;
    const text = await this.textOf(this.listRange, 15);
    return Number.parseInt(text.slice(text.lastIndexOf('من') + 2).trim(), 10);
  }

  /** the list total once it becomes expected (waits up to 15 s); the last value read otherwise */
  async listCountBecomes(expected: number): Promise<number> {
    const until = Date.now() + 15_000;
    let count = await this.listCount();
    while (count !== expected && Date.now() < until) count = await this.listCount();
    return count;
  }

  async clickAddEmployee(): Promise<void> {
    await this.click(this.addEmployeeButton, 15, 'Add employee');
    await this.isShownWithin(this.input(RegistrationRequestsPage.FIRST_NAME), 15);
  }

  async insertField(label: string, value: string): Promise<void> {
    await this.type(this.input(label), 10, value, label);
  }

  async pickAnyExistingDepartment(): Promise<void> {
    await this.click(this.departmentSelect, 10, 'Department');
    await this.click(this.firstDepartmentOption, 10, 'first department');
  }

  async clickSave(): Promise<void> {
    await this.click(this.saveButton, 10, 'Save');
  }

  /** the first message shown since the click (Save), waited up to 15 s; "" when none came */
  async toastText(seconds = 15): Promise<string> {
    return this.firstToastAfterAction(this.successToast, seconds);
  }

  async waitForDrawerToClose(): Promise<boolean> {
    return this.isGoneWithin(this.saveButton, 15);
  }

  async searchEmployee(userName: string): Promise<void> {
    await this.type(this.searchInput, 10, userName, 'Search');
    await this.click(this.showDataButton, 10, 'Show data');
    await this.settled(10);
  }

  /** rows of this user name once the search settles (waits up to 15 s for exactly expected) */
  async rowsOfUser(userName: string, expected: number): Promise<number> {
    return this.countBecomes(this.rowOfUser(userName), expected, 15);
  }

  async rowTextOfUser(userName: string): Promise<string> {
    return this.textOf(this.rowOfUser(userName), 15);
  }

  /** opens the page from the menu and waits for its Add employee button (no list wait) */
  async clickRegistrationRequests(): Promise<void> {
    await this.click(this.registrationRequestsLink, 20, 'Registration Requests');
    await this.isShownWithin(this.addEmployeeButton, 20);
  }

  async selectDepartment(department: string): Promise<void> {
    await this.click(this.departmentSelect, 10, 'Department');
    await this.click(this.option(department), 10, department);
  }

  /** Tab out of the field, so the form checks it */
  async pressTabIn(label: string): Promise<void> {
    await this.pressKey(this.input(label), 10, 'Tab', label);
  }

  /** false as soon as Save shows disabled (waits up to 10 s for the form to check); true when it stays enabled */
  async saveIsEnabled(): Promise<boolean> {
    return !(await this.isDisabledWithin(this.saveButton, 10));
  }

  async fieldErrorShown(label: string): Promise<boolean> {
    return this.isShownWithin(this.error(label), 10);
  }

  /** a "no error" check: gives the field 3 s to show an error, false when none shows */
  async fieldErrorExists(label: string): Promise<boolean> {
    return this.isShownWithin(this.error(label), 3);
  }

  async fieldErrorText(label: string): Promise<string> {
    return this.messageOf(this.error(label), 10);
  }

  /** the message under the field once it reads expected (waits up to 10 s); else what it shows */
  async fieldMessageShows(label: string, expected: string): Promise<string> {
    return this.textBecomes(this.error(label), expected, 10);
  }

  /** the field's value once it shows expected (waits up to 10 s); what it holds otherwise */
  async fieldValueBecomes(label: string, expected: string): Promise<string> {
    return this.valueBecomes(this.input(label), expected, 10);
  }

  /** rows with this job number once the list shows the one new row (waits up to 15 s after Save) */
  async rowsFor(jobNumber: string): Promise<number> {
    return this.countBecomes(this.rowOf(jobNumber), 1, 15);
  }

  async rowText(jobNumber: string): Promise<string> {
    return this.textOf(this.rowOf(jobNumber), 15);
  }

  async clickEditEmployee(userName: string): Promise<void> {
    await this.click(this.rowButton(userName, 'edit'), 15, 'Edit');
    await this.isShownWithin(this.input(RegistrationRequestsPage.FIRST_NAME), 15);
  }

  async clickDeleteEmployee(userName: string): Promise<void> {
    await this.click(this.rowButton(userName, 'delete'), 15, 'Delete');
  }

  async deleteConfirmShown(): Promise<boolean> {
    return this.isShownWithin(this.confirmTitle, 10);
  }

  async clickConfirmOk(): Promise<void> {
    await this.click(this.confirmOkButton, 10, 'OK');
  }

  async closeDrawer(): Promise<void> {
    await this.click(this.closeDrawerButton, 10, 'Close');
    await this.isGoneWithin(this.closeDrawerButton, 10);
  }

  /** deletes the request of this user name from the list and confirms; true once its row is gone (or it was never there) */
  async deleteEmployeeRequest(userName: string): Promise<boolean> {
    await this.searchEmployee(userName);
    if ((await this.rowsOfUser(userName, 1)) === 0) return true;
    await this.clickDeleteEmployee(userName);
    await this.deleteConfirmShown();
    await this.clickConfirmOk();
    return this.isGoneWithin(this.rowOfUser(userName), 15);
  }
}
