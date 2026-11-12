import { expect, test } from '@playwright/test';
import { testType } from '../../src/report/liveEvents';
import { LiveFrames } from '../../src/report/liveFrames';
import { afterEachCheck, checkTrue } from '../../src/report/checks';
import { attendanceReady } from '../../src/phone/screens/attendanceReady';
import { ScreenSnapshot } from '../../src/phone/screenSnapshot';
import { refusedPage } from '../../src/web/pageFacts';

test('a test says its kind in the words the run screen knows (Java: Web, Mobile, API) - a phone shows as a phone', () => {
  expect(testType(['Mob'])).toBe('Mobile');
  expect(testType(['Web'])).toBe('Web');
  expect(testType([])).toBe('API');
});

test('a phone picture is never left out: every step and check gets one (no 600 ms gap)', async () => {
  const said: unknown[] = [];
  const dir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'ph-'));
  const live = new LiveFrames(dir, () => 1000, (_t, f) => said.push(f));
  await live.add(Buffer.from('a'), 1, 'png', true);
  await live.add(Buffer.from('b'), 2, 'png', true);
  expect(said).toHaveLength(2);
});

test('each check tells who listens (the phone takes its picture after every check)', () => {
  let heard = 0;
  const stop = afterEachCheck(() => { heard++; });
  checkTrue('x', true);
  stop();
  checkTrue('y', true);
  expect(heard).toBe(1);
});

const NOT_READY = `<hierarchy><node class="android.widget.ImageView" resource-id="attendance_action_button" bounds="[438,1984][642,2188]"/></hierarchy>`;
const READY = `<hierarchy><node class="android.view.View" content-desc="خيارات تسجيل الانصراف&#10;بدون سمات حيويه" bounds="[0,0][1080,300]"/>
  <node class="android.view.View" resource-id="attendance_method_switcher" bounds="[180,135][900,250]"/>
  <node class="android.widget.ImageView" resource-id="attendance_action_button" bounds="[438,1984][642,2188]"/></hierarchy>`;

test('the attendance screen is ready only when its way of checking in is chosen (Test 8094 run 598: tapped at 1.3 s, refused)', () => {
  expect(attendanceReady(ScreenSnapshot.of(NOT_READY))).toBe(false);
  expect(attendanceReady(ScreenSnapshot.of(READY))).toBe(true);
});

test("an app page that says no rights (/401, /403, unauthorized) is not an app opened signed in (Test 8094 run 599)", () => {
  expect(refusedPage('https://app.x/401')).toBe(true);
  expect(refusedPage('https://app.x/#/403')).toBe(true);
  expect(refusedPage('https://app.x/unauthorized')).toBe(true);
  expect(refusedPage('https://app.x/auth/login')).toBe(true);
  expect(refusedPage('https://app.x/invoices')).toBe(false);
  expect(refusedPage('https://app.x/invoices/4011')).toBe(false);
});
