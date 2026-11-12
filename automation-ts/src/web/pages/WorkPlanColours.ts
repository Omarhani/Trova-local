import { Page } from '@playwright/test';
import { By } from '../by';
import { allOfColour, colourOf, coloursSeen } from '../planColour';
import { WebActions } from '../webActions';

/**
 * The work-plan calendar read by colour (TimetablesPage.getPlanColor / isPlanDisplayedInCalender /
 * countOtherPlansInCalender): every shift item has its plan's colour, so after the plan filter every one shown must
 * have the filtered plan's colour.
 */
export class WorkPlanColours extends WebActions {
  private readonly shownItems = By.xpath("//div[contains(@class,'box-event-title')]/div[contains(@class,'schedule-item')]");

  constructor(page: Page) {
    super(page);
  }

  private planItem(name: string): string {
    return By.xpath("//div[contains(@class,'plan-item')][.//div[contains(@class,'title')][normalize-space()='" + name + "']]");
  }

  /** the plan's colour in the plan list; a plain error when the plan shows none */
  async colourOfPlan(name: string): Promise<string> {
    if (!(await this.isShownWithin(this.planItem(name), 10))) throw new Error(`The plan ${name} is not in the plan list`);
    const colour = colourOf(await this.page.locator(this.planItem(name)).first().getAttribute('style'));
    if (!colour) throw new Error(`The plan ${name} shows no colour`);
    return colour;
  }

  /**
   * the colours of the shifts the filtered calendar shows, once every one has the plan's colour (it reloads a moment
   * after the filter: up to 15 s) - else what it showed last; [] when it shows none. A value, never a fixed count.
   */
  async coloursShown(colour: string): Promise<string[]> {
    const until = Date.now() + 15_000;
    let styles: string[] = [];
    for (;;) {
      styles = await this.page.locator(this.shownItems).evaluateAll((els) => els.map((e) => e.getAttribute('style') ?? ''));
      if (allOfColour(styles, colour) || Date.now() >= until) return coloursSeen(styles, colour);
      await this.page.waitForTimeout(250);
    }
  }
}
