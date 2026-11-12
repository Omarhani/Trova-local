import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import { ScreenSnapshot } from '../screenSnapshot';
import { attendanceReady } from './attendanceReady';
import { attendanceResult } from './attendanceResult';

/** The attendance screen (check in / check out) and the result page after it. */
export class AttendanceScreen extends PhoneActions {
  private readonly attendanceActionButton = AppiumBy.xpath("//android.widget.ImageView[@resource-id=\"attendance_action_button\"]");
  private readonly backToHomeButton = AppiumBy.xpath("//*[@content-desc=\"Back To Home\" or @content-desc=\"العودة إلى الصفحة الرئيسية\"]");

  /**
   * Taps the attendance button until the result message shows: a tap while the screen is still getting the location
   * is ignored (no request, no message) - up to 3 taps; a tap that sent always shows the message, so never twice.
   * 'success' / 'error' = the message the app showed; 'moved' = the screen left without one; 'none' = nothing happened.
   */
  async submit(): Promise<'success' | 'error' | 'moved' | 'none'> {
    await this.untilReady();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.tap(this.attendanceActionButton, 10, 'Attendance');
      const s = await this.lookUntil((x) => attendanceResult(x) !== 'not taken', 5);
      if (s) return this.resultAfterTap(s);
      console.log('Attendance tap ignored (no message, the button is still there) - tapping again');
    }
    return 'none';
  }

  /** the tap was taken: the message may come a moment after the button goes (run 607) - up to 8 s more for it */
  private async resultAfterTap(first: ScreenSnapshot): Promise<'success' | 'error' | 'moved'> {
    const r = attendanceResult(first);
    if (r === 'success' || r === 'error') return r;
    const s = await this.lookUntil((x) => { const v = attendanceResult(x); return v === 'success' || v === 'error'; }, 8);
    return s ? (attendanceResult(s) as 'success' | 'error') : 'moved';
  }

  /**
   * Test 8094 run 598: the screen is tapped only once its way of checking in shows (about 1.5-2 s after it opens) and it
   * still shows a look later - the way the AI runs wait for a screen to stand still (trova-phone-settle). 15 s at most.
   */
  private async untilReady(): Promise<void> {
    if (!(await this.lookUntil(attendanceReady, 15))) return; // not seen: the tap and its check say what happened
    await this.lookUntil(attendanceReady, 1);
    PhoneActions.picture(this.phone); // the ready screen on the run screen, before the tap
  }

  /** the result page shows sometimes only (a token refresh can reload straight to home): tapped when there */
  async backToHomeIfShown(): Promise<void> {
    if (await this.isPresent(this.backToHomeButton, 5)) await this.tap(this.backToHomeButton, 5, 'Back To Home');
  }
}
