import { Page } from '@playwright/test';
import { testData } from '../../run/testData';
import { By } from '../by';
import { pageOpens } from '../pageOpening';
import { BasePage } from './base/BasePage';

const VIEW = "//div[contains(@class,'user-profile__content')]";

/** الموظفين (/users) and the employee view (the eye) - the TS twin of pages.UsersPage. */
export class EmployeesPage extends BasePage {
  private readonly title = By.xpath("//h1[contains(normalize-space(),'الموظفين')]");
  private readonly searchInput = By.xpath("(//input[@placeholder='بحث'])[1]");
  private readonly anyRow = By.xpath('//table/tbody/tr');
  private readonly viewStatus = By.xpath(VIEW + "//span[contains(concat(' ', @class, ' '), ' status-badge ')]");
  private readonly viewClose = By.xpath(VIEW + "//button[contains(@class,'profile-close')]");

  constructor(page: Page) {
    super(page);
  }

  private row(email: string): string {
    return By.xpath("//table/tbody/tr[td[normalize-space()='" + email + "']]");
  }

  private otherRow(email: string): string {
    return By.xpath("//table/tbody/tr[not(td[normalize-space()='" + email + "'])]");
  }

  private viewName(fullName: string): string {
    return By.xpath(VIEW + "//h2[contains(@class,'profile-name')][normalize-space()='" + fullName + "']");
  }

  private card(label: string): string {
    return By.xpath(VIEW + "//div[contains(@class,'info-card__content')][span[contains(@class,'info-card__label')][normalize-space()='" + label + "']]/span[contains(@class,'info-card__value')]");
  }

  async openEmployees(): Promise<void> {
    await pageOpens(this.page, 'The Employees page', 20, async () => {
      await this.open(`${testData.webUrl().replace(/\/+$/, '')}/users`);
      return this.isShownWithin(this.title, 20);
    });
  }

  /** the list filters on Enter, after its first load (else the first load lands after the search and shows every row) */
  async searchByUserName(email: string): Promise<void> {
    await this.isShownWithin(this.anyRow, 20);
    await this.type(this.searchInput, 10, email, 'Search');
    for (let enter = 1; enter <= 2; enter++) {
      await this.pressKey(this.searchInput, 10, 'Enter', 'Search');
      if ((await this.isShownWithin(this.row(email), 10)) && (await this.isGoneWithin(this.otherRow(email), 5))) return;
    }
    if (!(await this.isShownWithin(this.row(email), 10))) throw new Error(`${email} is not in the Employees list`);
  }

  /** the eye of the employee's row; waits until the view shows that employee */
  async openView(email: string, fullName: string): Promise<void> {
    await this.click(By.xpath("//table/tbody/tr[td[normalize-space()='" + email + "']]//button[.//app-icon[@iconname='view']]"), 10, 'View');
    if (!(await this.isShownWithin(this.viewName(fullName), 20))) throw new Error(`The view of ${fullName} did not open within 20 s`);
  }

  async viewStatusText(): Promise<string> {
    return (await this.textOf(this.viewStatus, 10)).trim();
  }

  async cardValue(label: string): Promise<string> {
    return (await this.textOf(this.card(label), 10)).trim();
  }

  async closeView(): Promise<void> {
    await this.click(this.viewClose, 10, 'Close');
    await this.isGoneWithin(By.xpath(VIEW), 10);
  }
}
