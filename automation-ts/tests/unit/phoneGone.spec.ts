import { expect, test } from '@playwright/test';
import { isPhoneGone, onPhone, PHONE_CLOSED } from '../../src/phone/phoneGone';
import { PhoneActions } from '../../src/phone/phoneActions';
import { Phone } from '../../src/phone/phoneSession';

/** the driver's words in Test 8094 run 605 (the phone was used by another session at the same time) */
const RUN_605 = 'invalid session id: WebDriverError: A session is either terminated or not started when running "source" with method "GET"';

test('the ended-session errors of run 605 are seen as the phone connection gone', () => {
  expect(isPhoneGone(new Error(RUN_605))).toBe(true);
  expect(isPhoneGone(new Error("'GET /session/1/source' cannot be proxied to UiAutomator2 server because the instrumentation process is not running (probably crashed)"))).toBe(true);
  expect(isPhoneGone(new Error('Could not proxy command to the remote server. Original error: socket hang up'))).toBe(true);
});

test('any other error is not the phone connection gone', () => {
  expect(isPhoneGone(new Error('"login_button" did not show within 10 s'))).toBe(false);
  expect(isPhoneGone(undefined)).toBe(false);
});

test('a phone call whose session ended fails with plain words, not the driver error', async () => {
  await expect(onPhone(() => Promise.reject(new Error(RUN_605)))).rejects.toThrow(PHONE_CLOSED);
});

test('a phone call that fails for another reason keeps its own error; one that works gives its answer', async () => {
  await expect(onPhone(() => Promise.reject(new Error('no such element')))).rejects.toThrow('no such element');
  expect(await onPhone(() => Promise.resolve(7))).toBe(7);
});

test('the plain words say what happened and what to do, with no driver words', () => {
  expect(PHONE_CLOSED).toMatch(/phone connection closed during the case/i);
  expect(PHONE_CLOSED).not.toMatch(/session|webdriver|appium|uiautomator|instrumentation/i);
});

class LookAt extends PhoneActions {
  screen() {
    return this.look();
  }
  typeKey() {
    return this.shell('input', 'keyevent', '66');
  }
}

test('a screen look or a key press after the session ended fails with the plain words (run 605)', async () => {
  const gone = () => Promise.reject(new Error(RUN_605));
  const phone = { getPageSource: gone, execute: gone } as unknown as Phone;
  await expect(new LookAt(phone).screen()).rejects.toThrow(PHONE_CLOSED);
  await expect(new LookAt(phone).typeKey()).rejects.toThrow(PHONE_CLOSED);
});
