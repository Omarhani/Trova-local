import { AppiumBy } from '../../web/by';
import { ScreenSnapshot } from '../screenSnapshot';

const ACTION = AppiumBy.xpath("//android.widget.ImageView[@resource-id='attendance_action_button']");
const SUCCESS = AppiumBy.xpath("//android.widget.ImageView[@resource-id='success_snackbar']");
const ERROR = AppiumBy.xpath("//android.widget.ImageView[@resource-id='error_snackbar']");

export type AttendanceResult = 'success' | 'error' | 'not taken' | 'waiting';

/**
 * What the screen says after the attendance tap: the app's message, or 'not taken' while the button is still there
 * (the tap was ignored), or 'waiting' when the screen left before its message showed - Test 8094 run 607: the
 * check-out was saved, the message came ~1.5 s after the button went, and was read as "moved".
 */
export function attendanceResult(screen: ScreenSnapshot): AttendanceResult {
  if (screen.has(SUCCESS)) return 'success';
  if (screen.has(ERROR)) return 'error';
  return screen.has(ACTION) ? 'not taken' : 'waiting';
}
