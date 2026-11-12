import { expect, test } from '@playwright/test';
import { attendanceResult } from '../../src/phone/screens/attendanceResult';
import { ScreenSnapshot } from '../../src/phone/screenSnapshot';

const STILL_THERE = `<hierarchy><node class="android.widget.ImageView" resource-id="attendance_action_button" bounds="[438,1984][642,2188]"/></hierarchy>`;
const LEFT_NO_MESSAGE_YET = `<hierarchy><node class="android.view.View" content-desc="loading" bounds="[0,0][1080,300]"/></hierarchy>`;
const SUCCESS = `<hierarchy><node class="android.widget.ImageView" resource-id="success_snackbar" bounds="[0,0][1080,200]"/>
  <node class="android.view.View" content-desc="العودة إلى الصفحة الرئيسية" bounds="[0,2000][1080,2100]"/></hierarchy>`;
const ERROR = `<hierarchy><node class="android.widget.ImageView" resource-id="error_snackbar" bounds="[0,0][1080,200]"/></hierarchy>`;

test('the attendance screen leaving before its message is still waiting, not "moved" (Test 8094 run 607: check-out saved, read as moved)', () => {
  expect(attendanceResult(ScreenSnapshot.of(LEFT_NO_MESSAGE_YET))).toBe('waiting');
});

test('the attendance result is the message the app shows; the button still there means the tap was not taken', () => {
  expect(attendanceResult(ScreenSnapshot.of(SUCCESS))).toBe('success');
  expect(attendanceResult(ScreenSnapshot.of(ERROR))).toBe('error');
  expect(attendanceResult(ScreenSnapshot.of(STILL_THERE))).toBe('not taken');
});
