import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';
import { pageOpens } from '../pageOpening';

/** Account settings (/account/settings) - the Attendance settings card "Overtime". The portal runs in Arabic. */
export class OvertimeSettingsPage extends WebActions {
  private readonly profileMenu = By.xpath("//a[.//img[@alt='profile']]");
  private readonly changeAccountInformationButton = By.xpath("//button[normalize-space()='تغيير معلومات الحساب']");
  private readonly attendanceSettingsLink = By.xpath("//a[normalize-space()='إعدادات الحضور و الانصراف']");
  private readonly overtimeCardHeader = By.xpath("//div[contains(@class,'card-header')][.//span[normalize-space()='العمل الإضافي']]");
  private readonly overtimeSwitch = By.id('isExtraWork');
  private readonly monthlyBalanceInput = By.id('OvertimeRequestMonthlyBalanceHours');
  private readonly minimumHoursInput = By.id('MinimumExtraHours');
  private readonly maximumHoursInput = By.id('MaximumExtraHours');
  private readonly monthlyBalanceLabel = By.xpath("//label[normalize-space()='رصيد طلبات العمل الإضافي (ساعات) شهري'] | //*[not(*)][normalize-space()='رصيد طلبات العمل الإضافي (ساعات) شهري']");
  private readonly emptyMeansNoLimitHint = By.xpath("//*[not(*)][contains(normalize-space(),'اتركه فارغاً للسماح بالطلبات دون حد أقصى')]");
  private readonly saveButton = By.xpath("//button[normalize-space()='حفظ']");
  private readonly anyFieldMessage = By.xpath("//*[contains(@class,'invalid-error')][normalize-space()!='']");

  constructor(page: Page) {
    super(page);
  }

  private messageWith(text: string): string {
    return By.xpath("//*[contains(@class,'invalid-error')][contains(normalize-space(),'" + text + "')]");
  }

  /** user menu > Change account information; waits for the settings page */
  async openChangeAccountInformation(): Promise<void> {
    await pageOpens(this.page, 'The account settings page', 20, async () => {
      await this.click(this.profileMenu, 15, 'Profile');
      await this.click(this.changeAccountInformationButton, 15, 'Change account information');
      return this.isShownWithin(this.attendanceSettingsLink, 20);
    });
  }

  /** opens the Attendance settings card and its Overtime part (opened once: a second click would fold it) */
  async openOvertimeSettings(): Promise<void> {
    await this.click(this.attendanceSettingsLink, 15, 'Attendance settings');
    await this.settled(20);
    if (!(await this.isShownWithin(this.overtimeSwitch, 3))) await this.click(this.overtimeCardHeader, 15, 'Overtime');
    if (!(await this.isShownWithin(this.overtimeSwitch, 20))) throw new Error('The Overtime section did not open within 20 s');
  }

  /** sets the Overtime switch on (reads it first, clicks only when it is off) */
  async turnOvertimeOn(): Promise<void> {
    await this.setSwitch(this.overtimeSwitch, true, 10, 'Overtime');
  }

  async monthlyBalanceFieldShown(): Promise<boolean> {
    return (await this.isShownWithin(this.monthlyBalanceInput, 10)) && this.isShownWithin(this.monthlyBalanceLabel, 10);
  }

  async emptyMeansNoLimitShown(): Promise<boolean> {
    return this.isShownWithin(this.emptyMeansNoLimitHint, 10);
  }

  async enterMonthlyBalance(hours: string): Promise<void> {
    await this.type(this.monthlyBalanceInput, 10, hours, 'Monthly balance');
  }

  async setMinimumDailyOvertime(hours: string): Promise<void> {
    await this.type(this.minimumHoursInput, 10, hours, 'Minimum daily overtime');
  }

  async setMaximumDailyOvertime(hours: string): Promise<void> {
    await this.type(this.maximumHoursInput, 10, hours, 'Maximum daily overtime');
  }

  /** clicks Save; the app greys Save out while a value is refused, then there is nothing to click and the message says why */
  async clickSave(): Promise<void> {
    if (await this.isEnabledWithin(this.saveButton, 3)) await this.click(this.saveButton, 10, 'Save');
  }

  /** the message under the fields once it shows ("" when it never does); expected is the text the app should show */
  async messageShows(expected: string): Promise<string> {
    return this.textBecomes(this.messageWith(expected.replace(/\./g, '').trim()), expected, 10);
  }

  /** any message under the fields, waited for briefly; "" when none shows */
  async anyMessage(): Promise<string> {
    return this.messageOf(this.anyFieldMessage, 4);
  }

  async monthlyBalanceValue(): Promise<string> {
    return this.valueOf(this.monthlyBalanceInput);
  }

  async minimumHoursValue(): Promise<string> {
    return this.valueOf(this.minimumHoursInput);
  }

  async maximumHoursValue(): Promise<string> {
    return this.valueOf(this.maximumHoursInput);
  }

  /** opens the settings again from the page's address, as a person reloading it, and shows the Overtime part */
  async reopenOvertimeSettings(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    if (!(await this.isShownWithin(this.attendanceSettingsLink, 20))) throw new Error('The account settings page did not open again within 20 s');
    await this.openOvertimeSettings();
  }
}
