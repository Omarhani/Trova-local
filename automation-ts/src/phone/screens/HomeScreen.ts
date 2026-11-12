import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import { ScreenSnapshot } from '../screenSnapshot';

/** right after an attendance action home may reload from an older server state 1-4 s later (Java HomeScreen, 2026-09-23) */
const STEADY_SECONDS = 4;

/** The phone app's home: its Check-In / Check-Out button and the last activity it shows. */
export class HomeScreen extends PhoneActions {
  private readonly selfServicesButton = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'Self Services') or contains(@content-desc, 'الخدمات الذاتية')]");
  private readonly allowLocation = AppiumBy.xpath("//android.widget.Button[@resource-id=\"com.android.permissioncontroller:id/permission_allow_one_time_button\"]");
  private readonly checkInButton = AppiumBy.xpath("//android.widget.ImageView[@resource-id=\"checkin_button\"]");
  private readonly checkOutButton = AppiumBy.xpath("//android.widget.ImageView[@resource-id=\"checkout_button\"]");
  private readonly attendanceActionButton = AppiumBy.xpath("//android.widget.ImageView[@resource-id=\"attendance_action_button\"]");
  private readonly checkInLastActivity = AppiumBy.xpath("//android.view.View[@content-desc=\"Check in\" or @content-desc=\"تسجيل حضور\"]");
  private readonly checkOutLastActivity = AppiumBy.xpath("//android.view.View[@content-desc=\"Check out\" or @content-desc=\"تسجيل انصراف\"]");

  /** the location question shows only when permissions were not granted at the start - 3 s at most */
  async allowLocationIfAsked(): Promise<void> {
    if ((await this.look()).has(this.allowLocation)) await this.tap(this.allowLocation, 3, 'Allow location'); // one look, no wait
  }

  /** home has loaded: its Self Services tab shows (20 s - after a sign-in the app waits on the server) */
  async isShown(): Promise<boolean> {
    return this.isPresent(this.selfServicesButton, 20);
  }

  /** true when home offers Check-Out now (the employee is already checked in) */
  async offersCheckOut(seconds: number): Promise<boolean> {
    const s = await this.lookUntil((x) => x.has(this.checkOutButton) || x.has(this.checkInButton), seconds);
    return s !== undefined && s.has(this.checkOutButton);
  }

  async waitUntilReadyToCheckIn(): Promise<void> {
    await this.waitUntilShows(this.checkInButton, undefined, 'Check-In before the check in');
  }

  async waitUntilCheckOutIsAvailable(): Promise<void> {
    await this.waitUntilShows(this.checkOutButton, this.checkInLastActivity, 'Check-Out after a check in');
  }

  async waitUntilCheckInIsAvailable(): Promise<void> {
    await this.waitUntilShows(this.checkInButton, this.checkOutLastActivity, 'Check-In after a check out');
  }

  async checkInLastActivityIsShown(): Promise<boolean> {
    return this.isPresent(this.checkInLastActivity, 10);
  }

  async checkOutLastActivityIsShown(): Promise<boolean> {
    return this.isPresent(this.checkOutLastActivity, 10);
  }

  async openCheckIn(): Promise<void> {
    await this.openAttendance(this.checkInButton, 'Check-In');
  }

  async openCheckOut(): Promise<void> {
    await this.openAttendance(this.checkOutButton, 'Check-Out');
  }

  /**
   * Taps a home attendance button until the attendance screen opens: the app now and then ignores a tap (home stays,
   * nothing opens) - up to 3 taps. Opening the screen sends nothing, so this never checks in or out by itself.
   */
  private async openAttendance(button: string, name: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.tap(button, 10, name);
      if (await this.isPresent(this.attendanceActionButton, 6)) { PhoneActions.picture(this.phone); return; } // the opened screen on the run screen (run 598)
      if (!(await this.isPresent(button, 1))) return;
      console.log(`${name} tap ignored (the attendance screen did not open) - tapping again`);
    }
  }

  /**
   * Waits until home shows the button to tap next AND the matching last activity, and still shows it 4 s later: right
   * after an attendance action the app may reload home from an older server state and flip back. 60 s at most.
   */
  private async waitUntilShows(button: string, lastActivity: string | undefined, state: string): Promise<void> {
    const shows = (s: ScreenSnapshot): boolean => s.has(button) && (lastActivity === undefined || s.has(lastActivity));
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (!(await this.lookUntil(shows, Math.max(1, (deadline - Date.now()) / 1000)))) break;
      if (!(await this.lookUntil((s) => !shows(s), STEADY_SECONDS))) return; // looked for 4 s: still the same = settled
      console.log(`Home flipped back after showing ${state} (the app reloaded) - waiting again`);
    }
    throw new Error(`Home never settled on ${state} within 60 s`);
  }
}
