import { Page } from '@playwright/test';
import { By } from '../by';
import { WebActions } from '../webActions';

/** day of month of a yyyy-MM-dd day, as the calendar cell shows it ("9") */
function dayNumber(day: string): string {
  return String(Number(day.slice(8, 10)));
}

/** The work-plan calendar's day cells read as values: the shift titles a day shows (TimetablesPage.isDisplayedScheduleItemUsingName). */
export class WorkPlanCalendar extends WebActions {
  constructor(page: Page) {
    super(page);
  }

  private titles(day: string): string {
    const d = dayNumber(day);
    return By.xpath("//*[@role='gridcell'][normalize-space()='" + d + "' or starts-with(normalize-space(),'" + d + " ')]"
      + "//div[contains(@class,'box-event-title')]//div[contains(concat(' ',normalize-space(@class),' '),' title ')]");
  }

  /** the shift titles the day's cell shows once it shows want (waits up to 20 s for the calendar to load); [] when none */
  async titlesOn(day: string, want: string): Promise<string[]> {
    const until = Date.now() + 20_000;
    for (;;) {
      const shown = (await this.page.locator(this.titles(day)).allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      if (shown.includes(want) || Date.now() >= until) return [...new Set(shown)];
      await this.page.waitForTimeout(250);
    }
  }

  /** the plan names the plan list shows once it shows want (waits up to 15 s); what it showed otherwise */
  async planNames(want: string): Promise<string[]> {
    const names = By.xpath("//div[contains(@class,'plan-item')]//div[contains(@class,'title')]");
    const until = Date.now() + 15_000;
    for (;;) {
      const shown = (await this.page.locator(names).allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      if (shown.includes(want) || Date.now() >= until) return [...new Set(shown)];
      await this.page.waitForTimeout(250);
    }
  }
}
