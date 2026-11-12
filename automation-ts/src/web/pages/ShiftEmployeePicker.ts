import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

const DIALOG = '(//mat-dialog-container)[last()]';

/**
 * "إضافة موظفين" of the shift form: picks ONE named employee (searched by job number, picked by name - the run's own
 * employee, never someone else's), the TS twin of TimetablesPage.clickAddEmployeesButton + selectEmployee. Old and new
 * design in one locator each.
 */
export class ShiftEmployeePicker extends WebActions {
  private readonly addEmployeesButton = By.xpath(DIALOG + "//button[contains(@class,'add-users-btn') or normalize-space()='إضافة موظفين']");
  private readonly departmentPicker = By.xpath(DIALOG + "//button[contains(normalize-space(),'مختارة')]");
  private readonly firstDepartmentCheckbox = By.xpath("//ngx-treeview-item[1]//input[@type='checkbox']");
  private readonly addEmployeesTitle = By.xpath(DIALOG + "//*[not(*)][normalize-space()='إضافة موظفين']");
  private readonly employeeSelect = By.xpath("(//label[@for='EmployeesIDs']/..//mat-select | " + DIALOG + '//mat-select)[1]');
  private readonly searchInput = By.xpath("//div[contains(@class,'mat-select-search-inner')]//input");
  private readonly saveEmployeesButton = By.xpath("(//app-employees-departments-select//button[normalize-space()='حفظ'] | " + DIALOG + "//button[normalize-space()='حفظ'])[1]");

  constructor(page: Page) {
    super(page);
  }

  private option(name: string): string {
    return By.xpath("//div[contains(@class,'mat-select-panel')]//mat-option[normalize-space()='" + name + "']");
  }

  /** opens "add employees", finds the employee by job number, picks it by name and saves the employees window */
  async addEmployee(jobNumber: string, name: string): Promise<void> {
    await this.click(this.addEmployeesButton, 10, 'Add employees');
    if (await this.isShownWithin(this.departmentPicker, 5)) { // the new design lists employees of the departments ticked
      await this.click(this.departmentPicker, 10, 'Departments');
      await this.setSwitch(this.firstDepartmentCheckbox, true, 10, 'department');
      await this.click(this.addEmployeesTitle, 10, 'Add employees title');
    }
    await this.click(this.employeeSelect, 10, 'Employee');
    if (await this.isShownWithin(this.searchInput, 3)) await this.type(this.searchInput, 10, jobNumber, 'Employee search');
    await this.click(this.option(name), 15, name);
    await this.page.keyboard.press('Escape');
    await this.click(this.saveEmployeesButton, 10, 'Save employees');
  }
}
