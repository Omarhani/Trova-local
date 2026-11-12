import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

/**
 * The from - to date filter the portal's report pages share (a Material date range: two read-only boxes the picker
 * fills) - set by script with input + change as the picker does (Java updateDate), days as yyyy-MM-dd.
 */
export class DayRangeFilter extends WebActions {
  private readonly fromDate = By.cssSelector('input[matstartdate]');
  private readonly toDate = By.cssSelector('input[matenddate]');

  constructor(page: Page) {
    super(page);
  }

  async showDays(from: string, to: string): Promise<void> {
    await this.putValue(this.fromDate, 15, from, 'From date');
    await this.putValue(this.toDate, 15, to, 'To date');
  }
}
