import { monthsAhead } from '../../data/leaveDay';
import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';

/**
 * The new-leave form's date picker (walked on the realme 7, Test, 2026-11-11): it opens on TODAY's month - for the "to"
 * date too - so it moves on month by month with its arrow, then taps the day ("11, Wednesday, November 11, 2026" /
 * "11, الأربعاء، ١١ نوفمبر ٢٠٢٦": the day number starts both) and Confirm.
 */
export class LeaveDatePicker extends PhoneActions {
  private readonly nextMonthButton = AppiumBy.xpath("//android.widget.Button[@tooltip-text='Next month' or @tooltip-text='الشهر التالي']");
  private readonly confirmButton = AppiumBy.xpath("//android.widget.Button[@content-desc='Confirm' or @content-desc='تأكيد']");
  private readonly todayMark = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, ', Today') or contains(@content-desc, 'تاريخ اليوم')]");

  async pick(field: string, day: Date, today: Date, name: string): Promise<void> {
    await this.tap(field, 10, name);
    const months = monthsAhead(today, day);
    for (let i = months; i > 0; i--) await this.tap(this.nextMonthButton, 10, 'Next month');
    // another month shows when today's mark has gone - never a day of the month that is sliding away
    if (months > 0 && !(await this.lookUntil((s) => !s.has(this.todayMark), 5))) {
      throw new Error(`The date picker did not move on ${months} month(s) from today's month within 5 s`);
    }
    await this.tap(this.dayButton(day.getDate()), 10, `Day ${day.getDate()}`);
    await this.tap(this.confirmButton, 10, 'Confirm');
    await this.lookUntil((s) => !s.has(this.confirmButton), 10);
  }

  private dayButton(day: number): string {
    return AppiumBy.xpath(`//android.widget.Button[starts-with(@content-desc, '${day}, ')]`);
  }
}
