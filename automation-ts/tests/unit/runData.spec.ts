import { expect, test } from '@playwright/test';
import { Credentials } from '../../src/run/credentials';
import { TestData } from '../../src/run/testData';

const logins = { Admin: { 'Account code': 'ACME', Username: 'a@x.sa', Password: 'p' } };
const data = {
  ENVIRONMENTS: { test: { WEB_URL: 'https://web.test', API_BASE_URI: 'https://api.test', MOBILE_API_BASE_URI: '' } },
  API: { HEADERS: { ServiceKey: 's' }, PER_REQUEST_HEADERS: ['RequestTime', 'RequestId'] },
  MOBILE: { APP_PACKAGE: 'app.x', APP_ACTIVITY: 'app.x.Main', APK_PATH: '' },
};

test('a login is found by name, case ignored, with its fields in order', () => {
  const c = new Credentials(() => logins);
  expect(Object.keys(c.of('admin'))).toEqual(['Account code', 'Username', 'Password']);
});

test('a field is read under any of its names', () => {
  expect(new Credentials(() => logins).get('Admin', 'account code|Account')).toBe('ACME');
});

test('an unknown login names the logins there are, never a value', () => {
  expect(() => new Credentials(() => logins).of('Nobody')).toThrow(/No login "Nobody" \(there are Admin\)/);
});

test('a missing field says which one and where to add it', () => {
  expect(() => new Credentials(() => logins).get('Admin', 'OTP')).toThrow(/has no field "OTP"/);
});

test('addresses come from the run environment, case ignored', () => {
  const t = new TestData(() => data, () => 'Test');
  expect(t.webUrl()).toBe('https://web.test');
  expect(t.apiUrl()).toBe('https://api.test');
});

test('an empty mobile API address falls back to the API address', () => {
  expect(new TestData(() => data, () => 'Test').mobileApiUrl()).toBe('https://api.test');
});

test('per-call headers get a fresh value: a time for time-like names, an id otherwise', () => {
  const h = new TestData(() => data, () => 'Test').apiHeadersForOneCall();
  expect(h.ServiceKey).toBe('s');
  expect(h.RequestTime).toMatch(/^\d{13}$/);
  expect(h.RequestId).toMatch(/^[0-9a-f-]{36}$/);
});

test('the phone app comes from Test Data', () => {
  expect(new TestData(() => data, () => 'Test').mobile()).toEqual({ appPackage: 'app.x', appActivity: 'app.x.Main', appFile: '' });
});
