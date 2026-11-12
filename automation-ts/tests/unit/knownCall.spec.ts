import { expect, test } from '@playwright/test';
import { fillKnownBody, findKnown, KnownCall, samePath, splitEndpoint } from '../../src/api/knownCall';

const known: KnownCall[] = [
  { side: 'MOBILE', method: 'POST', path: '/api/overtimeRequests/Create',
    body: '{"RequestDate":"{today}","RequestedMinutes":60,"Reason":"x","UserId":"u0","AccountId":0}' },
  { side: 'WEB', method: 'POST', path: '/api/overtimeRequests/Create', body: '{"web":true}' },
];

test('splitEndpoint takes the method off the path', () => {
  expect(splitEndpoint('POST /overtimeRequests/Create')).toEqual(['POST', '/overtimeRequests/Create']);
  expect(splitEndpoint('/x')).toEqual(['', '/x']);
});

test('the known call is found by side, method and path (an /api prefix on either side is the same path only when equal)', () => {
  expect(findKnown(known, 'MOBILE', 'POST', '/api/overtimeRequests/Create')?.side).toBe('MOBILE');
  expect(findKnown(known, 'WEB', 'POST', '/api/overtimeRequests/create')?.body).toBe('{"web":true}');
  expect(findKnown(known, 'MOBILE', 'POST', '/api/other')).toBeUndefined();
});

test('a {name} part of a path matches any part', () => {
  expect(samePath('/api/x/{id}', '/api/x/7')).toBe(true);
  expect(samePath('/api/x/{id}', '/api/y/7')).toBe(false);
});

test('given values win by field name, the sign-in fills its own ids, numbers stay numbers', () => {
  const body = JSON.parse(fillKnownBody(known[0], { USER_ID: 'u9', ACCOUNT_ID: '12' }, { RequestDate: '2026-11-09T00:00:00', Reason: 'r' }) ?? '{}');
  expect(body).toEqual({ RequestDate: '2026-11-09T00:00:00', RequestedMinutes: 60, Reason: 'r', UserId: 'u9', AccountId: 12 });
});

test('a field the known body lacks is added from the given values', () => {
  const body = JSON.parse(fillKnownBody(known[1], {}, { Extra: 1 }) ?? '{}');
  expect(body).toEqual({ web: true, Extra: 1 });
});

test('no known body and no values = no body', () => {
  expect(fillKnownBody(undefined, {}, {})).toBeUndefined();
});

test('a placeholder nobody gives stops with its name', () => {
  const k: KnownCall = { side: 'WEB', method: 'POST', path: '/x', body: '{"a":"{secretThing}"}' };
  expect(() => fillKnownBody(k, {}, {})).toThrow('secretThing');
});
