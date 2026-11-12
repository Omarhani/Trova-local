import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

const DIALOG = '//mat-dialog-container';

/** what the leave details window shows */
export interface LeaveDetails {
  employee: string;
  status: string;
  type: string;
  from: string;
  to: string;
  notes: string;
}

/** The leave details window (تفاصيل المغادرة) of the requests list - Java LeavesPage's details: label / value pairs, and Close. */
export class LeaveDetailsDialog extends WebActions {
  private readonly title = By.xpath(DIALOG + "//span[contains(.,'تفاصيل المغادرة')]");
  private readonly closeButton = By.xpath(DIALOG + "//button[contains(@class,'btn-danger-transparent')]");

  constructor(page: Page) {
    super(page);
  }

  /** a value by its label inside the window (the list behind has labels of the same name) */
  private value(label: string): Promise<string> {
    return this.messageOf(By.xpath(DIALOG + "//div[contains(@class,'col-4') and normalize-space()='" + label + "']/following-sibling::div[contains(@class,'col-8')]"), 10);
  }

  async isOpen(seconds: number): Promise<boolean> {
    return this.isShownWithin(this.title, seconds);
  }

  async details(): Promise<LeaveDetails> {
    if (!(await this.isOpen(10))) throw new Error('The leave details window did not open within 10 s');
    return {
      employee: await this.value('اسم الموظف'),
      status: await this.value('حالة الطلب'),
      type: await this.value('نوع الطلب'),
      from: await this.value('من تاريخ'),
      to: await this.value('إلى تاريخ'),
      notes: await this.value('الملاحظات'),
    };
  }

  async close(): Promise<void> {
    if (!(await this.isShownWithin(this.closeButton, 2))) return;
    await this.click(this.closeButton, 10, 'Close');
    await this.isGoneWithin(this.closeButton, 10);
  }
}
