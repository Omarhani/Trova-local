import { expect, test } from '@playwright/test';
import { callEvent, CallFacts, maskBody, maskUrl, openEvent, pathOf, serverSaid, wantedCall } from '../../src/report/networkEvents';

test('a token, password or verification code in an address is masked (utils.TestTimeline.maskUrl)', () => {
  expect(maskUrl('https://a.sa/x?token=abc&b=1&Password=p1&verificationCode=9')).toBe('https://a.sa/x?token=***&b=1&Password=***&verificationCode=***');
});

test('the path is the address without its host, masked; "/" for none', () => {
  expect(pathOf('https://a.sa/api/User/Get?token=t')).toBe('/api/User/Get?token=***');
  expect(pathOf('https://a.sa')).toBe('/');
});

test('secret fields of a body are masked (utils.ApiReport.mask): password, token, secret, verification code - text or number', () => {
  expect(maskBody('{"UserName":"o","Password":"p@1","AccessToken":"eyJ","otpVerificationCode":1234,"ClientSecret":"s"}'))
    .toBe('{"UserName":"o","Password":"***","AccessToken":"***","otpVerificationCode":"***","ClientSecret":"***"}');
});

test("the server's own words: Status false and Message; else the first validation error; else title", () => {
  expect(serverSaid('{"Status":false,"Message":"لا يمكن"}')).toEqual({ ss: false, msg: 'لا يمكن' });
  expect(serverSaid('{"errors":{"Name":["Name is required"]}}')).toEqual({ ss: undefined, msg: 'Name is required' });
  expect(serverSaid('not json')).toEqual({ ss: undefined, msg: '' });
});

const facts: CallFacts = { method: 'POST', url: 'https://a.sa/api/x?token=t', sent: 1000, status: 200, ms: 120.4,
  request: '{"Password":"p"}', response: '{"Status":false,"Message":"no"}', error: '' };

test('a call event has the Java fields: refused = 200 with Status false, bodies masked', () => {
  expect(callEvent(facts)).toEqual({ m: 'POST', p: '/api/x?token=***', url: 'https://a.sa/api/x?token=***', sent: 1000, s: 200,
    ms: 120, bad: false, warn: true, ss: false, msg: 'no', err: '', done: true, req: '{"Password":"***"}', res: '{"Status":false,"Message":"no"}' });
});

test('HTTP 4xx/5xx or no answer is bad; a call Trova made by API says so', () => {
  expect(callEvent({ ...facts, status: 500, response: '' }).bad).toBe(true);
  expect(callEvent({ ...facts, status: 0, error: 'net::ERR_FAILED' }).bad).toBe(true);
  expect(callEvent({ ...facts }, true).api).toBe(true);
});

test('a long body is shortened, with how much more there was', () => {
  const big = `{"a":"${'x'.repeat(1200)}"}`;
  expect(String(callEvent({ ...facts, response: big, status: 200 }).res)).toMatch(/\.\.\. \(\d+ more characters\)$/);
});

test('a page load is an open event: path, address, status, time, bad', () => {
  expect(openEvent({ ...facts, method: 'GET', status: 404 })).toEqual({ p: '/api/x?token=***', url: 'https://a.sa/api/x?token=***',
    sent: 1000, s: 404, ms: 120, bad: true, err: '' });
});

test("the page's own calls only: xhr, fetch and documents on http(s); no OPTIONS, files, assets or monitoring", () => {
  expect(wantedCall('xhr', 'https://a.sa/api/x', 'POST')).toBe(true);
  expect(wantedCall('document', 'https://a.sa/home', 'GET')).toBe(true);
  expect(wantedCall('xhr', 'https://a.sa/api/x', 'OPTIONS')).toBe(false);
  expect(wantedCall('script', 'https://a.sa/main.js', 'GET')).toBe(false);
  expect(wantedCall('fetch', 'https://a.sa/assets/i18n/ar.json', 'GET')).toBe(false);
  expect(wantedCall('fetch', 'https://www.google-analytics.com/collect', 'POST')).toBe(false);
  expect(wantedCall('fetch', 'data:text/plain,x', 'GET')).toBe(false);
});
