import { Page } from '@playwright/test';
import { WebLeave } from '../../data/webLeave';
import { By } from '../by';
import { WebActions } from '../webActions';

const DIALOG = '//mat-dialog-container';

/**
 * The portal's "add leave" dialog (اضافة مغادرة) - Java LeavesPage.addLeaveRequest for a day leave: the employee (searched
 * by job number, picked by name - the list redraws when the server's search answers), the type, then its sub type, the
 * from and to days (read-only picker boxes, set as the picker does), the note, Save. The caller reads the toast.
 */
export class LeaveForm extends WebActions {
  private readonly addButton = By.xpath("//button[normalize-space(text())='اضافة مغادرة']");
  private readonly employeeField = By.xpath(DIALOG + "//label[@for='TypeID']/following-sibling::app-employee-select-by-account//input");
  private readonly typeField = By.xpath(DIALOG + "//label[@for='ParentTypeID']/following-sibling::app-leave-type-select//mat-select");
  private readonly subTypeField = By.xpath(DIALOG + "//mat-select[@formcontrolname='TypeID']");
  private readonly fromDate = By.xpath(DIALOG + "//label[@for='FromDate']/following-sibling::app-single-date-picker//input");
  private readonly toDate = By.xpath(DIALOG + "//label[@for='ToDate']/following-sibling::app-single-date-picker//input");
  private readonly notesField = By.xpath(DIALOG + "//textarea[@formcontrolname='Notes']");
  private readonly saveButton = By.xpath(DIALOG + "//button[normalize-space()='حفظ']");

  constructor(page: Page) {
    super(page);
  }

  private option(text: string): string {
    return By.xpath("//mat-option//span[normalize-space() = '" + text + "']");
  }

  async add(leave: WebLeave): Promise<void> {
    await this.click(this.addButton, 10, 'Add leave');
    await this.chooseEmployee(leave.jobNumber, leave.fullName);
    await this.click(this.typeField, 10, 'Request type');
    await this.click(this.option(leave.type), 10, leave.type);
    await this.click(this.subTypeField, 10, 'Request sub type');
    await this.click(this.option(leave.subType), 10, leave.subType);
    await this.putValue(this.fromDate, 10, leave.from, 'From date');
    await this.putValue(this.toDate, 10, leave.to, 'To date');
    await this.type(this.notesField, 10, leave.notes, 'Notes');
    await this.click(this.saveButton, 10, 'Save');
  }

  /** the option found just before the server's search answer is redrawn under the click - so it is clicked again (3 tries) */
  private async chooseEmployee(jobNumber: string, fullName: string): Promise<void> {
    await this.type(this.employeeField, 10, jobNumber, 'Employee');
    for (let attempt = 1; ; attempt++) {
      try {
        await this.click(this.option(fullName), 10, fullName);
        return;
      } catch (e) {
        if (attempt === 3) throw e;
      }
    }
  }
}
