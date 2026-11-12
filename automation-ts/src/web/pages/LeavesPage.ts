import { Page } from '@playwright/test';
import { WebLeave } from '../../data/webLeave';
import { By } from '../by';
import { answersWithin, FROZEN } from '../frozenPage';
import { openPortalPath } from '../portalAddress';
import { WebActions } from '../webActions';
import { LeaveDetails, LeaveDetailsDialog } from './LeaveDetailsDialog';
import { LeaveForm } from './LeaveForm';
import { pageOpens } from '../pageOpening';

export type { WebLeave } from '../../data/webLeave';

/** one request's row in the list: the employee, the status, the type and its days */
export interface RequestRow {
  employee: string;
  status: string;
  type: string;
  from: string;
  to: string;
}

/** the list's columns (Java LeavesPage): 2 id, 4 employee, 7 status, 8 type, 11 from day, 12 to day */
const COLUMN = { employee: 4, status: 7, type: 8, from: 11, to: 12 } as const;

/**
 * The leave requests list (/leaves) - the TS twin of Java LeavesPage: add a leave (LeaveForm), a request's row and details
 * (LeaveDetailsDialog), and the row's accept / reject / delete icons, each confirmed. A decided or deleted request stays
 * in the list with its new status (deleted = "محذوف"). The portal runs in Arabic.
 */
export class LeavesPage extends WebActions {
  private readonly pageTitle = By.xpath("//h1[contains(text(),'المغادارات') or contains(., 'Leaves')]");
  private readonly tableRows = By.xpath('//table/tbody/tr');
  private readonly toast = By.xpath("//div[@role='alert'][normalize-space()]");
  private readonly confirmButton = By.xpath("//button[contains(@class,'swal2-confirm')]");
  private readonly confirmWindow = By.cssSelector('.swal2-container');
  private readonly form: LeaveForm;
  private readonly detailsDialog: LeaveDetailsDialog;

  constructor(page: Page) {
    super(page);
    this.form = new LeaveForm(page);
    this.detailsDialog = new LeaveDetailsDialog(page);
  }

  private cell(id: string, column: number): string {
    return By.xpath("//table/tbody/tr[td[2][normalize-space()='" + id + "']]/td[" + column + "]");
  }

  private newestIdOf(fullName: string): string {
    return By.xpath("(//table/tbody/tr[td[4][normalize-space()='" + fullName + "']]/td[2])[1]");
  }

  private icon(id: string, name: string): string {
    return By.xpath("//tr[td[2][normalize-space()='" + id + "']]//button[.//app-icon[@iconname='" + name + "']]");
  }

  async openLeaves(): Promise<void> {
    await pageOpens(this.page, 'The leave requests page', 20, () => this.leavesShown());
    await this.settled(20);
    await this.rowsShownWithin(this.tableRows, 15);
  }

  /** opens /leaves; true once its header shows (loaded twice at most) - a frozen page throws its own plain reason */
  private async leavesShown(): Promise<boolean> {
    await openPortalPath(this.page, '/leaves');
    // Java goHome waits 20 s for the header; run 688: the app hung on its start ("Starting") - the house rule's one
    // guarded load: loaded once more only when the header never came, then the plain reason
    // run 762: the page's own script is busy 20+ s on its first load - while it is busy, wait for it (up to the house's
    // 60 s); a reload would only start that work again
    if (!(await this.isShownWithin(this.pageTitle, 20)) && !(await answersWithin(this.page, 40_000)
      && await this.isShownWithin(this.pageTitle, 10))) {
      await openPortalPath(this.page, '/leaves').catch(() => undefined);
      if (!(await this.isShownWithin(this.pageTitle, 20))) {
        // runs 747 / 755: the app's page froze (its own script busy) - nothing was checked: BLOCKED, never FAILED
        if (!(await answersWithin(this.page, 5_000))) throw new Error(FROZEN);
        return false; // loaded twice
      }
    }
    return true;
  }

  async addLeave(leave: WebLeave): Promise<void> {
    await this.form.add(leave);
  }

  /** the toast once it reads expected - shown since the click (waited up to 15 s); the last one seen, "" when none came */
  async toastShows(expected: string, seconds = 15): Promise<string> {
    return this.toastAfterAction(this.toast, expected, seconds);
  }

  /** the employee's newest request: the first row with its name (the list puts the newest first) */
  async newestRequestIdOf(fullName: string): Promise<string> {
    await this.isGoneWithin(this.toast, 15);
    const id = (await this.messageOf(this.newestIdOf(fullName), 15)).trim();
    if (!id) throw new Error(`The requests list shows no request of ${fullName} within 15 s`);
    return id;
  }

  async requestRow(id: string): Promise<RequestRow> {
    const read = (column: number): Promise<string> => this.messageOf(this.cell(id, column), 15);
    return { employee: await read(COLUMN.employee), status: await read(COLUMN.status), type: await read(COLUMN.type),
             from: await read(COLUMN.from), to: await read(COLUMN.to) };
  }

  /** the row's eye icon, then what the details window shows */
  async requestDetails(id: string): Promise<LeaveDetails> {
    await this.rowIcon(id, 'view', 'View');
    return this.detailsDialog.details();
  }

  async closeDetails(): Promise<void> {
    await this.detailsDialog.close();
  }

  async accept(id: string): Promise<void> {
    await this.decide(id, 'accept', 'Accept');
  }

  async reject(id: string): Promise<void> {
    await this.decide(id, 'reject', 'Reject');
  }

  async deleteRequest(id: string): Promise<void> {
    await this.decide(id, 'delete', 'Delete');
  }

  /** the request's status in the list once it reads expected (the list reloads after a decision); the last one seen */
  async statusBecomes(id: string, expected: string): Promise<string> {
    return this.textBecomes(this.cell(id, COLUMN.status), expected, 20);
  }

  /** the row's icon, then OK on the "are you sure" window */
  private async decide(id: string, icon: string, name: string): Promise<void> {
    await this.rowIcon(id, icon, name);
    if (!(await this.isShownWithin(this.confirmButton, 10))) throw new Error(`The "are you sure" window did not show after ${name}`);
    await this.click(this.confirmButton, 10, 'OK');
  }

  /**
   * a row's icon: after an earlier decision its window fades out and the table redraws - so the window is waited away and
   * the row waited for; the icon sits at the end of a sideways-scrolling row (in view by script, then clicked)
   */
  private async rowIcon(id: string, icon: string, name: string): Promise<void> {
    await this.isGoneWithin(this.confirmWindow, 15);
    if (!(await this.isShownWithin(this.cell(id, 2), 15))) throw new Error(`Request ${id} is not in the requests list`);
    await this.at(this.icon(id, icon)).evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => undefined);
    await this.clickByScript(this.icon(id, icon), 10, `${name} request ${id}`);
  }
}
