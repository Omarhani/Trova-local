import { expect, test } from '@playwright/test';
import { renewDue, SavedSignIn } from '../../src/signin/savedSignIn';

const NOW = Date.UTC(2026, 10, 10, 15, 0, 0);
const S = NOW / 1000;

/** a token with these iat / exp (seconds) - built here, never a real one */
function token(iat: number, exp: number): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ iat, exp })}.sig`;
}

function saved(tok: string, madeAt = NOW - 10 * 60_000): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: tok }] }] },
    sessionStorage: {}, madeAt, fresh: 0 };
}

test('an hour-long sign-in with under 5 min left is due for one fresh sign-in', () => {
  expect(renewDue(saved(token(S - 3300, S + 240)), NOW)).toBe('in 4 min');
});

test('an hour-long sign-in with over 5 min left is not due', () => {
  expect(renewDue(saved(token(S - 3000, S + 600)), NOW)).toBeNull();
});

test('a 5-minute sign-in is due only in its last fifth (1 min)', () => {
  expect(renewDue(saved(token(S - 60, S + 240)), NOW)).toBeNull();
  expect(renewDue(saved(token(S - 250, S + 50)), NOW)).toBe('in 0 min');
});

test('a sign-in made under a minute ago is never renewed again (no loop)', () => {
  expect(renewDue(saved(token(S - 3590, S + 10), NOW - 30_000), NOW)).toBeNull();
});

test('a sign-in with no end time is never due', () => {
  expect(renewDue(saved('plain-value'), NOW)).toBeNull();
});

test('a cookie end time counts too', () => {
  const s = saved('x');
  s.storage.cookies.push({ name: 'session', value: 'v', domain: 'app.x', path: '/', expires: S + 120, httpOnly: true, secure: true, sameSite: 'Lax' });
  expect(renewDue(s, NOW)).toBe('in 2 min');
});
