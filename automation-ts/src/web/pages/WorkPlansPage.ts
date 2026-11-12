import { Page } from '@playwright/test';
import { dayShown } from '../../data/workPlanValues';
import { By } from '../by';
import { byLabel } from '../labelledValues';
import { setTime } from '../timePicker';
import { WebActions } from '../webActions';
import { pageOpens } from '../pageOpening';

const DIALOG = '(//mat-dialog-container)[last()]';
const WEEK = ['سبت', 'احد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

/** day of month of a yyyy-MM-dd day, as the calendar cell shows it ("9") */
function dayNumber(day: string): string {
  return String(Number(day.slice(8, 10)));
}

/** Work plans (خطط الدوام, /calendar-shifts) - the plan list, the shift calendar and their add / edit forms. The portal runs in Arabic. */
export class WorkPlansPage extends WebActions {
  private readonly scheduleMenu = By.xpath("//a[normalize-space()='مواعيد الدوام']");
  private readonly workPlansLink = By.xpath("//a[normalize-space()='خطط الدوام']");
  private readonly pageTitle = By.xpath("//h1[normalize-space()='خطط الدوام']");
  private readonly addPlanButton = By.xpath("//button[normalize-space()='إضافة خطة جديدة']");
  private readonly addShiftButton = By.xpath("//button[normalize-space()='إضافة']");
  private readonly nameInput = By.xpath(DIALOG + "//input[@formcontrolname='Name']");
  private readonly planDialogCountrySelect = By.xpath(DIALOG + '//mat-select');
  private readonly shiftPlanSelect = By.xpath(DIALOG + "//mat-select[@formcontrolname='WorkPlanID']");
  private readonly shiftRepeatSelect = By.xpath(DIALOG + "//mat-select[@formcontrolname='OccurranceType']");
  private readonly startDateInput = By.xpath(DIALOG + "//input[@placeholder='اختر تاريخ']");
  private readonly dialogSaveButton = By.xpath(DIALOG + "//button[normalize-space()='حفظ']");
  private readonly dialogCloseButton = By.xpath(DIALOG + "//button[contains(@class,'btn-danger-transparent')][.//i[contains(@class,'ri-close-line')]]");
  private readonly dialogOpen = By.xpath('//mat-dialog-container');
  private readonly addEmployeesButton = By.xpath(DIALOG + "//button[normalize-space()='إضافة موظفين']");
  private readonly departmentPicker = By.xpath(DIALOG + "//button[contains(normalize-space(),'مختارة')]");
  private readonly firstDepartmentCheckbox = By.xpath("//ngx-treeview-item[1]//input[@type='checkbox']");
  private readonly addEmployeesTitle = By.xpath(DIALOG + "//*[not(*)][normalize-space()='إضافة موظفين']");
  private readonly employeeSelect = By.xpath(DIALOG + '//mat-select');
  private readonly firstEmployeeOption = By.xpath('(//mat-option[normalize-space()])[1]');
  private readonly removeEmployeeButton = By.xpath(DIALOG + "//button[normalize-space(@title)='هل أنت متأكد من حذف الموظف ؟']");
  private readonly editIcon = By.xpath(DIALOG + "//button[.//i[contains(@class,'ri-edit-line')]]");
  private readonly deleteIcon = By.xpath(DIALOG + "//button[.//i[contains(@class,'ri-delete-bin-line')]]");
  private readonly okButton = By.xpath("(//button[normalize-space()='موافق'])[last()]");
  private readonly toast = By.xpath("//*[@id='toast-container' or @role='alert' or contains(@class,'toast') or contains(@class,'snack')][normalize-space()]");
  private readonly planFilterSelect = By.xpath('(//mat-select[@multiple])[1]');
  private readonly showDataButton = By.xpath("//button[normalize-space()='إعادة عرض البيانات']");

  constructor(page: Page) {
    super(page);
  }

  private planName(name: string): string {
    return By.xpath("//*[not(*)][normalize-space()='" + name + "']/ancestor::div[.//button][1]");
  }

  private planMenuButton(name: string): string {
    return By.xpath("//*[not(*)][normalize-space()='" + name + "']/ancestor::div[.//button][1]//button");
  }

  private menuItem(text: string): string {
    return By.xpath("//*[@role='menuitem'][normalize-space()='" + text + "']");
  }

  private day(name: string): string {
    return By.xpath(DIALOG + "//button[contains(@class,'day-button')][starts-with(normalize-space(),'" + name + "')]");
  }

  private daySelected(name: string): string {
    return By.xpath(DIALOG + "//button[contains(@class,'day-button')][contains(@class,'selected')][starts-with(normalize-space(),'" + name + "')]");
  }

  private option(text: string): string {
    return By.xpath("//mat-option[normalize-space()='" + text + "']");
  }

  private timeInput(label: string): string {
    return By.xpath(DIALOG + "//input[@placeholder='" + label + "']");
  }

  private dayCell(day: string): string {
    const d = dayNumber(day);
    return "//*[@role='gridcell'][normalize-space()='" + d + "' or starts-with(normalize-space(),'" + d + " ')]";
  }

  private shiftInCell(day: string, title: string): string {
    return By.xpath('(' + this.dayCell(day) + "//div[contains(@class,'box-event-title')]//div[contains(concat(' ',normalize-space(@class),' '),' title ')][normalize-space()='" + title + "'])[1]");
  }

  private shiftTimesInCell(day: string): string {
    return By.xpath(this.dayCell(day) + "//div[contains(@class,'box-event-title')]/div[contains(@class,'schedule-item')]");
  }

  /**
   * menu: Shift times > Work plans; waits for the page title and for the page to settle. Run 754: the side menu was still
   * drawing, the open "Shift times" was clicked shut and Work plans waited 15 s + 20 s of AI help - the menu is waited
   * for first, and a click that closed it gets the one guarded click more (house rule: a lost click)
   */
  async openWorkPlans(): Promise<void> {
    await pageOpens(this.page, 'The Work plans page', 20, async () => {
      await this.isShownWithin(this.scheduleMenu, 15);
      if (!(await this.isShownWithin(this.workPlansLink, 1))) {
        await this.click(this.scheduleMenu, 15, 'Shift times');
        if (!(await this.isShownWithin(this.workPlansLink, 3))) await this.click(this.scheduleMenu, 5, 'Shift times (again - it was open)');
      }
      await this.click(this.workPlansLink, 15, 'Work plans');
      return this.isShownWithin(this.pageTitle, 20);
    });
    await this.settled(20);
  }

  /** loads the page again, as a person reloading it, so what was made by API shows */
  async reloadWorkPlans(): Promise<void> {
    await pageOpens(this.page, 'The Work plans page (loaded again)', 20, async () => {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      return this.isShownWithin(this.pageTitle, 20);
    });
    await this.settled(20);
  }

  // ---- plans ----

  async clickAddPlan(): Promise<void> {
    await this.click(this.addPlanButton, 15, 'Add plan');
    await this.isShownWithin(this.nameInput, 15);
  }

  async enterPlanName(name: string): Promise<void> {
    await this.type(this.nameInput, 10, name, 'Plan name');
  }

  async selectCountry(country: string): Promise<void> {
    await this.click(this.planDialogCountrySelect, 10, 'Country');
    await this.click(this.option(country), 10, country);
  }

  /** sets one weekday button of the plan form on or off (reads it first, clicks only when it differs) */
  async setDay(name: string, on: boolean): Promise<void> {
    if ((await this.isShownWithin(this.daySelected(name), 1)) === on) return;
    await this.click(this.day(name), 10, name);
    const now = on ? await this.isShownWithin(this.daySelected(name), 5) : await this.isGoneWithin(this.daySelected(name), 5);
    if (!now) throw new Error(`The day ${name} did not turn ${on ? 'on' : 'off'} within 5 s`);
  }

  async turnOnEveryDay(): Promise<void> {
    for (const d of WEEK) await this.setDay(d, true);
  }

  async clickSave(): Promise<void> {
    await this.click(this.dialogSaveButton, 10, 'Save');
  }

  /** the toast text once it shows since the click (the expected one is waited for); "" when none came */
  async toastShows(expected: string, seconds = 15): Promise<string> {
    return this.toastAfterAction(this.toast, expected, seconds);
  }

  /** waits until the toast has gone, so the next one is not confused with it */
  async toastGone(): Promise<boolean> {
    return this.isGoneWithin(this.toast, 15);
  }

  async planShown(name: string): Promise<boolean> {
    return this.isShownWithin(this.planName(name), 15);
  }

  async planGone(name: string): Promise<boolean> {
    return this.isGoneWithin(this.planName(name), 15);
  }

  async clickPlanMenuItem(planName: string, item: string): Promise<void> {
    await this.click(this.planMenuButton(planName), 10, 'Plan menu');
    await this.click(this.menuItem(item), 10, item);
  }

  /** confirms the question that opens after Delete */
  async confirmDialog(): Promise<void> {
    await this.click(this.okButton, 10, 'OK');
  }

  // ---- shifts ----

  async clickAddShift(): Promise<void> {
    await this.click(this.addShiftButton, 15, 'Add shift');
    await this.isShownWithin(this.nameInput, 15);
  }

  async enterShiftTitle(title: string): Promise<void> {
    await this.type(this.nameInput, 10, title, 'Shift title');
  }

  async selectShiftPlan(planName: string): Promise<void> {
    await this.click(this.shiftPlanSelect, 10, 'Plan');
    await this.click(this.option(planName), 10, planName);
  }

  async selectRepeat(repeat: string): Promise<void> {
    await this.click(this.shiftRepeatSelect, 10, 'Repeat');
    await this.click(this.option(repeat.toLowerCase() === 'daily' ? 'يومي' : repeat), 10, repeat);
  }

  /** the start date as the form shows it, digits and slashes only ("31/10/2026") */
  async startDateShown(): Promise<string> {
    return (await this.valueOf(this.startDateInput)).replace(/[^0-9/]/g, '');
  }

  /** the start date the form shows as yyyy-MM-dd ("9/11/2026" and "09/11/2026" are the same day); undefined when not a date */
  async startDayShown(): Promise<string | undefined> {
    return dayShown(await this.startDateShown());
  }

  /** the start day: the form already shows it by default, otherwise this fails in plain words */
  async chooseStartDate(day: string): Promise<void> {
    if ((await this.startDayShown()) !== day) {
      throw new Error(`The start date shows ${await this.startDateShown()} and cannot be changed to ${day} here`);
    }
  }

  /** sets a time field ("10:00 am", "6 pm", Arabic digits) with the shared time picker (utils.TimePicker) */
  async chooseTime(label: string, time: string): Promise<void> {
    await setTime(this.page, this.timeInput(label), time, 10, label);
    this.picture();
  }

  /** in the add-employees window of the open shift form: the main department and its first employee, then Save */
  async addAnyEmployee(): Promise<void> {
    await this.click(this.addEmployeesButton, 10, 'Add employees');
    await this.isShownWithin(this.departmentPicker, 15);
    await this.click(this.departmentPicker, 10, 'Departments');
    await this.setSwitch(this.firstDepartmentCheckbox, true, 10, 'department');
    await this.click(this.addEmployeesTitle, 10, 'Add employees title');
    await this.click(this.employeeSelect, 10, 'Employee');
    await this.click(this.firstEmployeeOption, 10, 'first employee');
    await this.page.keyboard.press('Escape');
    await this.click(this.dialogSaveButton, 10, 'Save');
  }

  async removeEmployee(): Promise<void> {
    await this.click(this.removeEmployeeButton, 10, 'Remove employee');
  }

  async saveShift(): Promise<void> {
    await this.click(this.dialogSaveButton, 10, 'Save');
  }

  /** the "OK" question that follows an edit is confirmed when it shows */
  async confirmEditQuestion(): Promise<void> {
    if (await this.isShownWithin(this.okButton, 5)) await this.click(this.okButton, 10, 'OK');
  }

  async openShiftDetails(day: string, title: string): Promise<void> {
    await this.click(this.shiftInCell(day, title), 15, title);
    await this.isShownWithin(this.deleteIcon, 15);
  }

  /** a value of the shift's details by its label ("بداية الدوام" -> "10:00") */
  async detail(label: string): Promise<string> {
    return byLabel(this.page, 10, label);
  }

  async clickEditIcon(): Promise<void> {
    await this.click(this.editIcon, 10, 'Edit');
    await this.isShownWithin(this.nameInput, 15);
  }

  async clickDeleteIcon(): Promise<void> {
    await this.click(this.deleteIcon, 10, 'Delete');
  }

  async chooseDeleteScope(scope: string): Promise<void> {
    await this.click(By.xpath("//*[not(*)][normalize-space()='" + scope + "']"), 10, scope);
  }

  async shiftShown(day: string, title: string): Promise<boolean> {
    return this.isShownWithin(this.shiftInCell(day, title), 15);
  }

  async shiftGone(day: string, title: string): Promise<boolean> {
    return this.isGoneWithin(this.shiftInCell(day, title), 15);
  }

  /** filters the calendar by one plan */
  async filterByPlan(planName: string): Promise<void> {
    await this.click(this.planFilterSelect, 10, 'Plan filter');
    await this.click(this.option(planName), 10, planName);
    await this.page.keyboard.press('Escape');
    await this.click(this.showDataButton, 10, 'Show data');
    await this.settled(20);
  }

  /** the number of shifts the day's cell shows once it settles on expected */
  async shiftsOnDay(day: string, expected: number): Promise<number> {
    return this.countBecomes(this.shiftTimesInCell(day), expected, 15);
  }

  async closeDialog(): Promise<void> {
    await this.page.keyboard.press('Escape');
    if (!(await this.isGoneWithin(this.dialogOpen, 3))) await this.click(this.dialogCloseButton, 10, 'Close');
  }

  async dialogClosed(): Promise<boolean> {
    return this.isGoneWithin(this.dialogOpen, 10);
  }
}
