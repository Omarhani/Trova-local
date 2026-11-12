import { expect, test } from '@playwright/test';
import { signInPageShows } from '../../src/web/signin/signedOutPage';

/**
 * Test 8094 run 631 case 5: the shift form has a "shift code" box (CodeId) - it read as "the app asks for its code" and
 * the step was called a sign-out while the app stayed on /calendar-shifts with its menu. Signed out = the page really is
 * the app's sign-in page or refused page; the app's 401 / 403 answers are counted by MidRunSignIn.
 */

const start = 'https://app.x/auth/start';

test('a form with a code box on an app page, menu showing, is not a sign-out (run 631)', () => {
  expect(signInPageShows({ pw: false, login: false, path: '/calendar-shifts', mid: true, shell: true }, start)).toBe(false);
});

test('a code box on an app page without the menu is still not a sign-out', () => {
  expect(signInPageShows({ pw: false, login: false, path: '/calendar-shifts', mid: true, shell: false }, start)).toBe(false);
});

test('a password box on an app page with the menu (a new employee form) is not a sign-out', () => {
  expect(signInPageShows({ pw: true, login: false, path: '/employees/add', mid: false, shell: true }, start)).toBe(false);
});

test('a password box with no app menu is the sign-in page', () => {
  expect(signInPageShows({ pw: true, login: false, path: '/', mid: false, shell: false }, start)).toBe(true);
});

test('a sign-in address is the sign-in page, a code step on it too', () => {
  expect(signInPageShows({ pw: false, login: true, path: '/login', mid: false, shell: false }, start)).toBe(true);
  expect(signInPageShows({ pw: false, login: true, path: '/sign-in', mid: true, shell: false }, start)).toBe(true);
});

test("the login's own sign-in address is the sign-in page", () => {
  expect(signInPageShows({ pw: false, login: false, path: '/auth/start', mid: false, shell: false }, start)).toBe(true);
});

test('a refused page (unauthorized, forbidden, session expired) counts as signed out', () => {
  for (const path of ['/unauthorized', '/forbidden', '/access-denied', '/session-expired', '/401', '/#/403']) {
    expect(signInPageShows({ pw: false, login: false, path, mid: false, shell: false }, start), path).toBe(true);
  }
});

test('a page that could not be read is not a sign-out (the step fails with its own reason)', () => {
  expect(signInPageShows(undefined, start)).toBe(false);
});

test('an app page whose address only contains a refused word is not refused', () => {
  expect(signInPageShows({ pw: false, login: false, path: '/reports/unauthorized-leaves', mid: false, shell: true }, start)).toBe(false);
});
