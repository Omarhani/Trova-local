import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { JsonObject } from '../../src/trova/json';
import { family, meaningless, signedInNow } from '../../src/web/signin/signInPage';
import { screenSignIn } from '../../src/web/signin/screenSignIn';
import { pageLooksUnstyled } from '../../src/web/signin/pageLook';
import { isPageSetting, readPageSettings } from '../../src/web/signin/pageSettingsCapture';

/**
 * Java utils.ScreenSignIn, SignInAct, SignInPage, PageLook, PageSettingsCapture on small local pages (installed Chrome,
 * hidden): a sign-in on the screen with the login's saved steps, each element found again right before it is used.
 */
let browser: Browser;
let page: Page;
const APP = 'http://app.trova.test';

/** the sign-in page redraws its form after the account code (Availo, online run #14) and lands on /home when right */
const LOGIN = `<html><body><form id="f">
  <input id="account" name="account"><button type="button" id="next">Next</button></form>
  <script>
  document.getElementById('next').onclick = () => {
    const code = document.getElementById('account').value;
    document.getElementById('f').innerHTML = '<input id="user" name="user"><input id="pw" type="password"><button type="button" id="go">Sign in</button>';
    document.getElementById('go').onclick = () => {
      const ok = code === 'ACC' && document.getElementById('user').value === 'omar' && document.getElementById('pw').value === 'secret';
      if (ok) { localStorage.setItem('TOKEN', 't'); location.href = '/home'; }
      else document.body.insertAdjacentHTML('beforeend', '<div role="alert">Invalid user name or password</div>');
    };
  };
  </script></body></html>`;
const HOME = '<html><body><nav><a href="/a">Leaves</a><a href="/b">Invoices</a><a href="/c">Overtime</a></nav><h1>لوحة الأداء</h1></body></html>';

const START = `${APP}/login`;
const DONE = 'text=لوحة الأداء';
const recipe: JsonObject = {
  url: START,
  done: DONE,
  steps: [{ fill: '#account', field: 'Account code' }, { click: 'text=Next' }, { wait: 3000 },
    { fill: '#user', field: 'Username' }, { fill: '#pw', field: 'Password' }, { click: 'text=Sign in' }],
};

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  await page.route(`${APP}/**`, (r) => r.fulfill({ contentType: 'text/html', body: new URL(r.request().url()).pathname === '/home' ? HOME : LOGIN }));
});

test.afterAll(async () => {
  await browser.close();
});

test('signs in on the screen with the saved steps, the redrawn form found again step by step', async () => {
  await screenSignIn(page, `${APP}/home`, 'omar', recipe, { 'Account code': 'ACC', Username: 'omar', Password: 'secret' });
  expect(new URL(page.url()).pathname).toBe('/home');
  expect(await signedInNow(page, DONE, START)).toBeNull();
});

test('a refused screen sign-in says the app\'s own reason in plain words', async () => {
  await expect(screenSignIn(page, `${APP}/home`, 'omar', recipe, { 'Account code': 'ACC', Username: 'omar', Password: 'wrong' }))
    .rejects.toThrow('Trova refused: Invalid user name or password - fix the login in Test Data → Credentials');
});

test('a value the steps need and the login does not have is said plainly', async () => {
  await expect(screenSignIn(page, `${APP}/home`, 'omar', recipe, { 'Account code': 'ACC', Username: 'omar' }))
    .rejects.toThrow('The login "omar" has no Password - add it in Test Data → Credentials');
});

test('on the sign-in page the page is not signed in; the field kinds and an empty done are read like the AI agent', async () => {
  await page.goto(`${APP}/login`);
  expect(await signedInNow(page, DONE, START)).toBe('the app showed its sign-in page');
  expect(family('Password')).toBe('password');
  expect(family('Account code')).toBe('other');
  expect(family('OTP')).toBe('otp');
  expect(meaningless('true')).toBe(true);
  expect(meaningless('text=Home')).toBe(false);
});

test('a page with a menu and no colours looks unstyled; a styled one does not', async () => {
  await page.setContent('<nav style="height:200px"><a href="#">A</a><a href="#">B</a><a href="#">C</a></nav>');
  expect(await pageLooksUnstyled(page)).toContain('the side menu has no colours and no item looks picked');
  await page.setContent('<style>nav a { background: red; color: white }</style><nav style="height:200px"><a href="#">A</a><a href="#">B</a><a href="#">C</a></nav>');
  expect(await pageLooksUnstyled(page)).toEqual([]);
});

test('the sign-in page\'s own settings are read; a token, a user or a third-party key never is', async () => {
  await page.route(`${APP}/settings`, (r) => r.fulfill({ contentType: 'text/html', body: `<script>localStorage.setItem('lang', 'ar');
    localStorage.setItem('THEME', 'dark'); localStorage.setItem('authToken', 'x'); localStorage.setItem('_ga_1', 'y');</script>` }));
  const read = await readPageSettings(page, `${APP}/settings`);
  expect(read).toEqual({ localStorage: { lang: 'ar', THEME: 'dark' } });
  expect(isPageSetting('refresh', 'abc')).toBe(false);
  expect(isPageSetting('mode', 'eyJhbGciOiJIUzI1NiJ9a.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop')).toBe(false);
  expect(isPageSetting('dir', 'rtl')).toBe(true);
});
