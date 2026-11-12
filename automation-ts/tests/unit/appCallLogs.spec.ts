import { expect, test } from '@playwright/test';
import { AppLine } from '../../src/phone/logcatLine';
import { OkHttpLog } from '../../src/phone/okHttpLog';
import { DioLog } from '../../src/phone/dioLog';

const l = (at: number, tid: number, text: string, tag = 'okhttp.OkHttpClient'): AppLine => ({ at, pid: 4321, tid, level: 'I', tag, text });

test('an OkHttp call (request, body, answer, body) is one call with its status, time and bodies', () => {
  const log = new OkHttpLog();
  const out = [
    l(100, 7, '--> POST https://a.sa/api/Login'), l(100, 7, 'Content-Type: application/json'), l(100, 7, ''),
    l(100, 7, '{"UserName":"o","Password":"p"}'), l(100, 7, '--> END POST (31-byte body)'),
    l(300, 7, '<-- 200 OK https://a.sa/api/Login (185ms)'), l(300, 7, 'Set-Cookie: s=1'), l(300, 7, ''),
    l(300, 7, '{"Status":true,"Token":"t"}'), l(300, 7, '<-- END HTTP (27-byte body)'),
  ].flatMap((x) => log.read(x));
  expect(out).toEqual([{ method: 'POST', url: 'https://a.sa/api/Login', sent: 100, status: 200, ms: 185,
    request: '{"UserName":"o","Password":"p"}', response: '{"Status":true,"Token":"t"}', error: '' }]);
});

test('OkHttp calls on two threads at once are kept apart; headers never become a body', () => {
  const log = new OkHttpLog();
  const out = [
    l(1, 7, '--> GET https://a.sa/a'), l(2, 8, '--> GET https://a.sa/b'), l(2, 8, 'Authorization: Bearer x'),
    l(5, 8, '<-- 404 https://a.sa/b (3ms)'), l(5, 8, '<-- END HTTP'), l(9, 7, '<-- 200 OK https://a.sa/a (8ms)'), l(9, 7, '<-- END HTTP'),
  ].flatMap((x) => log.read(x));
  expect(out.map((c) => [c.method, c.url, c.status, c.request])).toEqual([['GET', 'https://a.sa/b', 404, undefined], ['GET', 'https://a.sa/a', 200, undefined]]);
});

test('an OkHttp call that got no answer is a call with status 0 and the reason', () => {
  const log = new OkHttpLog();
  const out = [l(1, 7, '--> GET https://a.sa/slow'), l(31, 7, '<-- HTTP FAILED: java.net.SocketTimeoutException: timeout')].flatMap((x) => log.read(x));
  expect(out).toEqual([{ method: 'GET', url: 'https://a.sa/slow', sent: 1, status: 0, ms: 30, request: undefined, response: undefined,
    error: 'java.net.SocketTimeoutException: timeout' }]);
});

test('an OkHttp answer cut off at the end of the case is still shown when the log is closed', () => {
  const log = new OkHttpLog();
  [l(1, 7, '--> GET https://a.sa/x'), l(4, 7, '<-- 200 OK https://a.sa/x (3ms)')].forEach((x) => log.read(x));
  expect(log.flush().map((c) => [c.url, c.status])).toEqual([['https://a.sa/x', 200]]);
  expect(log.flush()).toEqual([]);
});

const d = (at: number, text: string): AppLine => l(at, 1, text, 'flutter');

test('Dio calls (Flutter) are matched by address even when the answers come back in another order', () => {
  const log = new DioLog();
  const out = [
    d(10, '*** Request ***'), d(10, 'uri: https://a.sa/api/List'), d(10, 'method: GET'), d(10, 'headers:'), d(10, ' Authorization: Bearer x'),
    d(11, '*** Request ***'), d(11, 'uri: https://a.sa/api/Save'), d(11, 'method: POST'), d(11, 'data:'), d(11, '{"Name":"n"}'),
    d(50, '*** Response ***'), d(50, 'uri: https://a.sa/api/Save'), d(50, 'statusCode: 200'), d(50, 'Response Text:'), d(50, '{"Status":false,"Message":"no"}'), d(50, ''),
    d(90, '*** Response ***'), d(90, 'uri: https://a.sa/api/List'), d(90, 'statusCode: 200'), d(90, ''),
  ].flatMap((x) => log.read(x));
  expect(out).toEqual([
    { method: 'POST', url: 'https://a.sa/api/Save', sent: 11, status: 200, ms: 39, request: '{"Name":"n"}', response: '{"Status":false,"Message":"no"}', error: '' },
    { method: 'GET', url: 'https://a.sa/api/List', sent: 10, status: 200, ms: 80, request: undefined, response: undefined, error: '' },
  ]);
});

test('a Dio error is a call with the status the error names, else 0 and the reason', () => {
  const log = new DioLog();
  const out = [
    d(1, '*** Request ***'), d(1, 'uri: https://a.sa/api/Me'), d(1, 'method: GET'),
    d(5, '*** DioException ***:'), d(5, 'uri: https://a.sa/api/Me'), d(5, 'DioException [bad response]: the request returned a status code of 401'), d(5, ''),
  ].flatMap((x) => log.read(x));
  expect(out.map((c) => [c.method, c.status, c.error])).toEqual([['GET', 401, 'DioException [bad response]: the request returned a status code of 401']]);
});

test("lines that are not a call's log give nothing", () => {
  expect(new OkHttpLog().read(l(1, 1, 'Loading the home screen'))).toEqual([]);
  expect(new DioLog().read(d(1, 'uri is a word'))).toEqual([]);
  expect(new DioLog().flush()).toEqual([]);
});
