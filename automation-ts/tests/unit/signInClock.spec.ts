import { expect, test } from '@playwright/test';
import { endOf, endOfToken } from '../../src/web/signin/signInClock';

/** Java utils.SignInClock: when a sign-in runs out, read from its own values - nothing here knows the app. */

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);

function token(claims: Record<string, number>): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.sig`;
}

test('a token\'s "exp" is when the sign-in runs out', () => {
  const end = endOfToken(token({ exp: NOW / 1000 + 600 }), NOW);
  expect(end.at).toBe(NOW + 600_000);
  expect(end.soon(NOW)).toBe(false);
  expect(end.expired(NOW)).toBe(false);
});

test('a short sign-in (5 min) is refreshed when 20% of its life is left; a long one 2 min before', () => {
  const short = endOfToken(token({ iat: NOW / 1000 - 240, exp: NOW / 1000 + 60 }), NOW);
  expect(short.soon(NOW)).toBe(true);
  const long = endOfToken(token({ iat: NOW / 1000 - 3600, exp: NOW / 1000 + 180 }), NOW);
  expect(long.soon(NOW)).toBe(false);
  expect(long.soon(NOW + 61_000)).toBe(true);
});

test('the shortest end of the kept keys wins: a token inside a stored JSON value, an expiry field, a cookie', () => {
  const state = {
    localStorage: { session: JSON.stringify({ user: { token: token({ exp: NOW / 1000 + 3000 }) } }), expiresAt: new Date(NOW + 900_000).toISOString() },
    sessionStorage: {},
    cookies: { sid: 'x' },
  };
  expect(endOf(state, NOW).at).toBe(NOW + 900_000);
});

test('analytics keys, an end older than 30 days and a relative "expires_in" do not count', () => {
  const state = {
    localStorage: { _ga_x: token({ exp: NOW / 1000 + 10 }), stale_expiry: String(NOW - 40 * 86_400_000), expires_in: '3600' },
    sessionStorage: {},
    cookies: {},
  };
  expect(endOf(state, NOW).at).toBe(0);
  expect(endOf(state, NOW).soon(NOW)).toBe(false);
});

test('when the sign-in keys are tagged, only they count', () => {
  const state = {
    localStorage: { TOKEN: token({ exp: NOW / 1000 + 3000 }), other: token({ exp: NOW / 1000 + 100 }) },
    sessionStorage: {},
    cookies: {},
    signIn: [{ place: 'localStorage', key: 'TOKEN' }],
  };
  expect(endOf(state, NOW).at).toBe(NOW + 3_000_000);
});

test('a run-out sign-in is expired and its words say how long ago', () => {
  const end = endOfToken(token({ exp: NOW / 1000 - 180 }), NOW);
  expect(end.expired(NOW)).toBe(true);
  expect(end.words(NOW)).toBe('3 min ago');
  expect(endOfToken('not a token', NOW).at).toBe(0);
});
