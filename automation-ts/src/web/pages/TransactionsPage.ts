import { Page } from '@playwright/test';
import { MovementKind, SideNames } from '../../api/services/transactionsApi';
import { By } from '../by';
import { ClockTime } from '../clockTime';
import { openPortalPath } from '../portalAddress';
import { shownTime } from '../shownTime';
import { WebClicks } from '../webClicks';
import { DayRangeFilter } from './DayRangeFilter';
import { coveredNow } from '../covers';
import { filterToEmployee } from './movementsFilter';
import { MovementDrawer } from './MovementDrawer';
import { CallsInFlight } from '../callsInFlight';
import { pageOpens } from '../pageOpening';

const OVERLAY = "//div[contains(@class,'cdk-overlay-container')]";


/** the movement type words in the table */
const KIND_WORD: Readonly<Record<MovementKind, string>> = { 'check in': 'تحضير', 'check out': 'انصراف' };

/**
 * The movements page (إدارة الحركات > تعديل موعد الحضور, /transactions/managment) - the TS twin of Java
 * TransactionManagementPage: the day, one employee's card (searched by job number - names repeat on Test), a new check
 * in and its check out, an order-safe edit of both, and the times the employee's table shows. The portal runs in Arabic.
 */
export class TransactionsPage extends WebClicks {
  private readonly pageTitle = By.xpath("//h1[normalize-space(text())='تعديل موعد الحضور']");
  private readonly employeeSelect = By.xpath("//app-departments-employees-select[@class='ng-star-inserted']");
  private readonly employeeSearch = By.xpath(OVERLAY + "//div[contains(@class,'mat-select-search-inner')]//input");
  private readonly showAgainButton = By.xpath("//button[normalize-space()='إعادة عرض البيانات']");
  private readonly addMovementButton = By.xpath("//button[contains(text(),'إضافة حركة جديدة')]");
  private readonly addCheckOutIcon = By.xpath("(//app-icon[@iconname='add'])[2]");
  private readonly cardTitles = By.xpath("//div[contains(@class,'card-title')]/span");
  private readonly drawer: MovementDrawer;
  /** run 721: the page's movement-list loads still waiting - a slower, earlier load must not replace the employee's list */
  private readonly listLoads: CallsInFlight;
  private shownName = '';

  constructor(page: Page) {
    super(page);
    this.drawer = new MovementDrawer(page);
    this.listLoads = new CallsInFlight(page, /\/Reports\/GetUsersTransactionCorrections/);
  }

  private employeeOption(fullName: string): string {
    return By.xpath(OVERLAY + "//span[contains(text(),'" + fullName + "')]");
  }

  /** the employee's table: the one right after its card header "<name> - (<e-mail>)" (other employees' cards come first) */
  private table(fullName: string): string {
    return "(//*[contains(text(),'" + fullName + " - (')])[1]/following::table[1]";
  }

  private rows(fullName: string, kind: MovementKind): string {
    return By.xpath(this.table(fullName) + "//tr[contains(., '" + KIND_WORD[kind] + "')]");
  }

  private editButton(fullName: string, kind: MovementKind): string {
    return By.xpath("(" + this.table(fullName) + "//tr[contains(., '" + KIND_WORD[kind] + "')])[1]//button[descendant::app-icon[@iconname='edit']]");
  }

  async openTransactions(): Promise<void> {
    await pageOpens(this.page, 'The movements page', 30, async () => {
      await openPortalPath(this.page, '/transactions/managment');
      return this.isShownWithin(this.pageTitle, 30);
    });
    await this.settled(20);
  }

  /** the day (yyyy-MM-dd) as from and to - applied by the ONE "Show again" after the employee is picked (Java, run 687) */
  async showDay(day: string): Promise<void> {
    await new DayRangeFilter(this.page).showDays(day, day);
  }

  /**
   * one employee's card the way Java's selectFirstEmployee does it (run 687): loaded, the employee picked (searched by
   * job number), ONE "Show again" (the filters do not apply by themselves), loaded, then every card is the employee's
   * (or none for 2 s in a row: a day with no movement). Still loading = BLOCKED, a slow answer.
   */
  async showEmployee(jobNumber: string, fullName: string): Promise<void> {
    await filterToEmployee({
      loaded: (seconds) => this.loaded(seconds),
      pickEmployee: async () => {
        await this.click(this.employeeSelect, 10, 'Employee');
        await this.type(this.employeeSearch, 10, jobNumber, 'Employee search');
        await this.click(this.employeeOption(fullName), 10, fullName);
        await this.pressEscape();
      },
      showAgain: () => this.click(this.showAgainButton, 10, 'Show again'),
      onlyCardOf: (seconds) => this.onlyCardOf(fullName, seconds),
    }, fullName);
    this.shownName = fullName;
  }

  /** Java waitUntilLoaded: the page's loading layer gone (seen only while it can be seen - run 684's opacity rule) */
  private async loaded(seconds: number): Promise<boolean> {
    await this.settled(seconds);
    // run 723: the page's first list load (every employee) answers last and wins over the employee's - wait for it first
    if (!(await this.listLoads.idle(seconds * 1000))) return false;
    return !(await coveredNow(this.page));
  }

  /** "إضافة حركة جديدة": a check in at time ("9:00 am") for the employee shown, on the side found by API when given */
  async addCheckIn(time: string, side?: SideNames): Promise<void> {
    await this.click(this.addMovementButton, 10, 'Add new movement');
    await this.drawer.addAt(time, side);
  }

  /** the "+" on the check in's row: its check out at time; the click counts only once the new drawer is up (5 tries) */
  async addCheckOut(time: string, side?: SideNames): Promise<void> {
    await this.drawer.waitClosed();
    for (let attempt = 1; ; attempt++) {
      await this.clickByScript(this.addCheckOutIcon, 10, 'Add check out');
      if (await this.drawer.isOpen(3)) break;
      if (attempt === 5) throw new Error('The check out drawer did not open after 5 clicks on the check in row\'s +');
    }
    await this.drawer.addAt(time, side);
  }

  /**
   * the employee's check in and check out set to these times, in the order the app takes (it never saves a check in
   * after the check out): check in first unless the new check in is after the stored check out; a day with no check
   * out gets one added on the check in's row (Java updatePreparationAndDeparture / setCheckInAndOut)
   */
  async setCheckInAndOut(checkIn: string, checkOut: string): Promise<void> {
    const name = this.employeeShown();
    const stored = ClockTime.read((await this.timesOf(name, 'check out'))[0]);
    if (!stored) {
      await this.edit(name, 'check in', checkIn);
      await this.addCheckOut(checkOut);
      return;
    }
    const next = ClockTime.parse(checkIn);
    const inFirst = next.hour24 * 60 + next.minute <= stored.hour24 * 60 + stored.minute;
    const order: Array<[MovementKind, string]> = inFirst ? [['check in', checkIn], ['check out', checkOut]] : [['check out', checkOut], ['check in', checkIn]];
    for (const [kind, time] of order) await this.edit(name, kind, time);
  }

  /** the times ("HH:mm") of the employee's movements of kind, as its table shows them (none = []) */
  async timesOf(fullName: string, kind: MovementKind): Promise<string[]> {
    await this.settled(15);
    if ((await this.rowsShownWithin(this.rows(fullName, kind), 10)) === 0) return [];
    const cells = await this.all(this.rows(fullName, kind)).evaluateAll((rows) =>
      rows.map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent ?? '')));
    return cells.map((row) => row.map(shownTime).find((t): t is string => t !== undefined) ?? '');
  }

  /** the row's edit icon (a script click: the row can sit under the scrolling card - Java smartClick), new time, saved */
  private async edit(fullName: string, kind: MovementKind, time: string): Promise<void> {
    await this.drawer.waitClosed();
    await this.clickByScript(this.editButton(fullName, kind), 10, `Edit ${kind}`);
    await this.drawer.editTo(time);
  }

  private employeeShown(): string {
    if (!this.shownName) throw new Error('No employee is shown on the movements page - show the employee first');
    return this.shownName;
  }

  /**
   * every card on the page is the employee's; or no card at all for 2 s in a row (a list still loading does not count).
   * Run 721: only once no list load is still waiting - an earlier, slower load of every employee replaced the table after
   * the filtered one had shown
   */
  private async onlyCardOf(fullName: string, seconds: number): Promise<boolean> {
    const until = Date.now() + seconds * 1000;
    let emptySince = 0;
    while (Date.now() < until) {
      const loading = this.listLoads.count > 0; // run 721: a list load still waiting - nothing on the page counts yet
      const titles = loading ? [] : await this.all(this.cardTitles).allInnerTexts().catch(() => []);
      if (loading) {
        emptySince = 0;
      } else if (titles.length === 0) {
        emptySince ||= Date.now();
        if (Date.now() - emptySince >= 2000) return true;
      } else {
        emptySince = 0;
        if (titles.every((t) => t.includes(`${fullName} - (`))) return true;
      }
      await this.page.waitForTimeout(250);
    }
    return false;
  }
}
