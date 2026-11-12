import { AppiumBy } from '../../web/by';
import { ScreenSnapshot } from '../screenSnapshot';

/** the way of checking in (the method switcher) - the screen shows it once it has built its check-in (about 1.5-2 s) */
const METHOD_SWITCHER = AppiumBy.xpath("//*[@resource-id='attendance_method_switcher']");
const ACTION = AppiumBy.xpath("//android.widget.ImageView[@resource-id='attendance_action_button']");

/**
 * Test 8094 run 598: "Attendance" tapped 1.3 s after "Check-In" got the app's refuse screen - the button shows at once,
 * the way of checking in about 1.5-2 s later (seen on the phone, 2026-11-10). Ready = both show.
 */
export function attendanceReady(screen: ScreenSnapshot): boolean {
  return screen.has(METHOD_SWITCHER) && screen.has(ACTION);
}
