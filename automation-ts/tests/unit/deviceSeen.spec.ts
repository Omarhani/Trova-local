import { expect, test } from '@playwright/test';
import { browserSeen, phoneSeen } from '../../src/report/deviceSeen';

/** Round 2 (tester bug 1): a TS run tells Trova the phone and the browser it really used - the Runs list shows them. */

test('the phone session names the phone by its serial and model', () => {
  expect(phoneSeen({ 'appium:udid': 'EE4PORJ7S86TYHFU', deviceModel: 'RMX2163', deviceManufacturer: 'realme' }))
    .toEqual({ phone: 'EE4PORJ7S86TYHFU', model: 'realme RMX2163' });
  expect(phoneSeen({ deviceUDID: 'R58', deviceModel: 'SM-S911B' })).toEqual({ phone: 'R58', model: 'SM-S911B' });
  expect(phoneSeen({})).toBeUndefined();
});

test('the browser the run started, as the Run dialog names it', () => {
  expect(browserSeen('headlessChrome')).toEqual({ browser: 'headlessChrome' });
  expect(browserSeen('chrome')).toEqual({ browser: 'chrome' });
  expect(browserSeen('')).toBeUndefined();
});
