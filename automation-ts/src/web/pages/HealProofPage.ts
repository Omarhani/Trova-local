import { Page } from '@playwright/test';
import { By } from '../by';
import { WebClicks } from '../webClicks';

/**
 * Self-healing proof (Omar 2026-11-11): the work plans page with one thing broken ON PURPOSE per case, so each cause the
 * AI help must name is seen live - our renamed locator, a pop-up in the way, a toast our read misses, the network cut,
 * the app answering an error or a wrong value. Used only by the self-healing proof suites (tests/web/healProof) - here
 * so a treatment of its renamed link or toast box is allowed and proven like any page class. Only case 3 saves (one plan,
 * deleted by the suite's API clean-up).
 */
export class HealProofPage extends WebClicks {
  private readonly scheduleMenu = By.xpath("//a[normalize-space()='مواعيد الدوام']");
  /** the real link is "خطط الدوام" - this name is wrong on purpose (case 1) */
  private readonly renamedWorkPlansLink = By.xpath("//a[normalize-space()='خطط الدوام القديمة']");
  private readonly workPlansTitle = By.xpath("//h1[normalize-space()='خطط الدوام']");
  private readonly addPlanButton = By.xpath("//button[normalize-space()='إضافة خطة جديدة']");
  private readonly planDialog = By.xpath('//mat-dialog-container');
  private readonly planFilterSelect = By.xpath('(//mat-select[@multiple])[1]');
  private readonly firstPlanOption = By.xpath('(//mat-option[normalize-space()])[1]');
  private readonly planOptions = By.xpath('//mat-option[normalize-space()]');
  /** the app's toast is "toast-container" / role alert - this old box name is wrong on purpose (case 3: our read misses it) */
  private readonly oldToastBox = By.xpath("//*[@id='toast-box-old'][normalize-space()]");

  constructor(page: Page) {
    super(page);
  }

  /**
   * case 1: the menu, then the work plans link by a name the app does not have; true once the Work plans page shows.
   * Stuck until a treatment fixes the link's name - then it passes by itself, the proof of the treatment.
   */
  async openByRenamedLink(): Promise<boolean> {
    await this.isShownWithin(this.scheduleMenu, 15);
    if (!(await this.isShownWithin(this.renamedWorkPlansLink, 1))) await this.click(this.scheduleMenu, 15, 'Shift times');
    await this.click(this.renamedWorkPlansLink, 10, 'Work plans (renamed on purpose)');
    return this.isShownWithin(this.workPlansTitle, 20);
  }

  /** case 2: a pop-up over the whole page, with its own close button (as an app notice would be) */
  async coverWithPopup(): Promise<void> {
    await this.page.evaluate(() => {
      const box = document.createElement('div');
      box.id = 'trova-proof-popup';
      box.setAttribute('role', 'dialog');
      box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;padding:24px;border-radius:8px;font:16px Arial';
      card.textContent = 'إشعار: تحديث جديد متاح ';
      const close = document.createElement('button');
      close.textContent = 'إغلاق';
      close.onclick = () => box.remove();
      card.appendChild(close);
      box.appendChild(card);
      document.body.appendChild(box);
    });
  }

  /** Add plan, then whether its dialog opened (closed again with Escape - nothing is saved) */
  async addPlanOpens(): Promise<boolean> {
    await this.click(this.addPlanButton, 10, 'Add plan');
    const open = await this.isShownWithin(this.planDialog, 10);
    await this.pressEscape();
    return open;
  }

  /** cases 3 and 4: the plan filter's options (they come from the app's plan list call) */
  async planOptionsShow(): Promise<boolean> {
    await this.click(this.planFilterSelect, 10, 'Plan filter');
    await this.click(this.firstPlanOption, 10, 'First plan');
    return true;
  }

  /** case 3: the toast read by a box name the app does not have - "" although the app showed its message */
  async toastReadByOldBox(expected: string): Promise<string> {
    return this.textBecomes(this.oldToastBox, expected, 15);
  }

  /** case 6: every plan name the plan filter lists (closed again with Escape) */
  async planFilterNames(): Promise<string[]> {
    await this.click(this.planFilterSelect, 10, 'Plan filter');
    await this.rowsShownWithin(this.planOptions, 10);
    const names = (await this.all(this.planOptions).allInnerTexts()).map((t) => t.trim());
    await this.pressEscape();
    return names;
  }
}
