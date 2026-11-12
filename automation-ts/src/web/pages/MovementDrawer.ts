import { Page, test } from '@playwright/test';
import { blockedSkip } from '../../report/blockedSkip';
import { By } from '../by';
import { WebClicks } from '../webClicks';
import { refusedBy } from './saveAnswer';
import { SideNames } from '../../api/services/transactionsApi';
import { firstSideWithGates, noSideWithGates, sideOption } from './sideWithGates';

const OPTION = "//mat-option[contains(@class,'mat-option mat-focus-indicator')]";

/**
 * The add / edit movement drawer of the movements page (إضافة حركة جديدة) - Java TransactionManagementPage's drawer steps:
 * the movement's time (a read-only picker box, set as the picker does), the side and the gate (each the first the list
 * offers - the gate list depends on the side), Save, and the save going through (the drawer closes, the toast comes and goes).
 */
export class MovementDrawer extends WebClicks {
  private readonly drawerTitle = By.xpath("//span[text()='إضافة حركة جديدة']");
  private readonly timeField = By.xpath("//input[@placeholder='وقت الحركة']");
  private readonly sideField = By.cssSelector("mat-select[formcontrolname='DepartmentID']");
  private readonly gateField = By.cssSelector("mat-select[formcontrolname='accessGateId']");
  private readonly firstOption = By.xpath("//mat-option[contains(@class,'mat-option mat-focus-indicator')]//span[1]");
  private readonly options = By.xpath(OPTION);
  private readonly openList = By.cssSelector('.mat-select-panel, .mat-mdc-select-panel');
  private readonly saveButton = By.xpath("//button[normalize-space(text())='حفظ']");
  private readonly toast = By.xpath("//div[@role='alert']");

  constructor(page: Page) {
    super(page);
  }

  /** the drawer's title is up (a click on add counts only then) */
  async isOpen(seconds: number): Promise<boolean> {
    return this.isShownWithin(this.drawerTitle, seconds);
  }

  /** an earlier drawer has left the page (its gate list would catch the next drawer's clicks - Java 2026-09-23) */
  async waitClosed(): Promise<void> {
    await this.countBecomes(this.drawerTitle, 0, 15);
  }

  /** a new movement: its time ("9:00 am"), the side found by API (else the first that has gates), its first gate; saved */
  async addAt(time: string, side?: SideNames): Promise<void> {
    await this.isOpen(10);
    await this.setTime(time);
    if (side?.names.length) await this.pickSide(side);
    else await this.pickSideWithGates();
    await this.click(this.firstOption, 10, 'First gate');
    await this.save();
  }

  /** case 529: the side the set-up found by API, chosen by its name, then its gate list opened - once, no side tried in vain */
  private async pickSide(side: SideNames): Promise<void> {
    await this.click(this.sideField, 5, 'Side');
    await this.click(By.xpath(sideOption(side)), 10, side.names[0]);
    await this.click(this.gateField, 5, 'Gate');
  }

  /**
   * the first side whose gate list has a gate, the gate list left open (run 913: the first side had none); a side with
   * no gates is skipped; none at all = Not tested - needs a department with gates
   */
  private async pickSideWithGates(): Promise<void> {
    await this.pickFirst(this.sideField, 'Side');
    await this.click(this.sideField, 5, 'Side');
    const count = await this.settledCount(this.options, 10);
    await this.pressEscape();
    const at = await firstSideWithGates(count, (i) => this.sideHasGates(i));
    if (at === undefined) blockedSkip(test.info(), 'data', noSideWithGates(count));
  }

  /** side i chosen (the first is already chosen), then its gate list opened: true when it offers a gate */
  private async sideHasGates(i: number): Promise<boolean> {
    if (i > 0) {
      await this.click(this.sideField, 5, 'Side');
      await this.click(By.xpath(`(${OPTION})[${i + 1}]`), 10, `Side ${i + 1}`);
    }
    await this.click(this.gateField, 5, 'Gate');
    if (await this.isShownWithin(this.firstOption, 10)) return true;
    if (await this.isShownWithin(this.openList, 1)) await this.pressEscape();
    return false;
  }

  /** an edited movement: its new time only; saved */
  async editTo(time: string): Promise<void> {
    await this.setTime(time);
    await this.save();
  }

  /** the time box is drawn a moment after the drawer (Java: ~300 ms) - waited for, then set */
  private async setTime(time: string): Promise<void> {
    await this.putValue(this.timeField, 15, time, 'Movement time');
  }

  /**
   * a list's first option; its options can come after the drawer opens (Stage 2026-09-24) - open, wait 10 s, else close
   * the empty list with Escape (never a click on the drawer's own backdrop, which closes the drawer) and open it again: 3 tries
   */
  private async pickFirst(field: string, name: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.click(field, 5, name);
      if (await this.isShownWithin(this.firstOption, 10)) {
        await this.click(this.firstOption, 5, `First ${name.toLowerCase()}`);
        return;
      }
      if (await this.isShownWithin(this.openList, 1)) await this.pressEscape();
    }
    throw new Error(`The ${name} list offered no option after 3 tries`);
  }

  /**
   * Save, then the save went through: the drawer closed (its time box gone) and the toast came and went. Run 721: the
   * app refused (its message up, the drawer still open) - FAILED at once with the app's own words, never 30 s more
   */
  private async save(): Promise<void> {
    await this.click(this.saveButton, 15, 'Save');
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
      if (await this.isGoneWithin(this.timeField, 0.5)) {
        if (await this.isShownWithin(this.toast, 10)) await this.isGoneWithin(this.toast, 15);
        return;
      }
      const said = await this.messageOf(this.toast, 0);
      if (refusedBy(said)) throw new Error(`Expected: the movement is saved / Actual: the app said "${said}"`); // runs 733/737: never its success words
    }
    throw new Error('The movement drawer did not close within 30 s of Save');
  }
}
