import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { proofVerdict, proveSignedIn } from '../../src/web/signin/appProof';

/**
 * Every case proves it is signed in before any step counts: the app's own first call answers 2xx, none of its calls
 * says 401 / 403, and the page is not the sign-in page (Test 8094 run 609: the menu showed, the first call was refused,
 * the app went to its sign-in page 2.5 s later; run 624: the app answered 401 to the run's sign-in).
 */
const WEB = 'http://app.test/';
const MENU = '<nav><a href="#/a">One</a><a href="#/b">Two</a><a href="#/c">طلبات التسجيل</a></nav>';
const DROPS = `<html><body>${MENU}<script>
  setTimeout(() => fetch('/api/me').then((r) => { if (r.status === 401) { location.hash = '#/login';
    document.body.innerHTML = '<form><input name="user"><input type="password"></form>'; } }), 300);
</script></body></html>`;
const STAYS = `<html><body>${MENU}<script>setTimeout(() => fetch('/api/me'), 300);</script></body></html>`;
const SILENT = `<html><body>${MENU}</body></html>`;
const COVERED = `<html><body><div class="loading-overlay" style="position:fixed;inset:0">...</div>${MENU}<script>
  fetch('/api/me').then(() => document.querySelector('.loading-overlay').remove());
</script></body></html>`;
const MAPPED = `<html><body>${MENU}<script>fetch('/api/me');
  setInterval(() => fetch('https://maps.googleapis.com/maps/api/js/ViewportInfo'), 300);
</script></body></html>`;

let browser: Browser;
let page: Page;

async function app(html: string, status = 200, waitMs = 800): Promise<void> {
  await page.unrouteAll();
  await page.route('http://app.test/api/me', async (r) => {
    await new Promise((w) => setTimeout(w, waitMs));
    await r.fulfill({ status, body: '{}' });
  });
  await page.route(WEB, (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('https://maps.googleapis.com/**', (r) => r.fulfill({ status: 200, body: '{}' }));
}

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('an app whose first call answers 401 and goes to its sign-in page is refused, with the status', async () => {
  await app(DROPS, 401);
  expect(await proveSignedIn(page, WEB)).toBe('its calls answered 401');
});

test('an app whose first call answers 403 is refused', async () => {
  await app(STAYS, 403);
  expect(await proveSignedIn(page, WEB)).toBe('its calls answered 403');
});

test('an app that stays signed in and whose first call answers 200 is proved, without a long wait', async () => {
  await app(STAYS);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(4000);
});

test('an app busy with its first calls is watched while it loads - no second wait after it settled (Test 8094 run 615)', async () => {
  await app(COVERED, 200, 1500);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2900);
});

test('a page whose map keeps calling Google is done once the app\'s own calls are quiet (Test 8094 run 616)', async () => {
  await app(MAPPED);
  const start = Date.now();
  expect(await proveSignedIn(page, WEB)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2900);
});

test('an app that makes no call of its own is not taken as signed in', async () => {
  await app(SILENT);
  expect(await proveSignedIn(page, WEB, { firstMs: 500 })).toBe('it made no call of its own, so Trova could not see it signed in');
});

test('the verdict: a sign-in page, a refused call, a failed first call, or proved', () => {
  expect(proofVerdict({ url: 'http://app.test/#/login', held: true, statuses: [200] })).toBe('it went to its sign-in page');
  expect(proofVerdict({ url: 'http://app.test/', held: false, statuses: [200] })).toBe('it went to its sign-in page');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [200, 401] })).toBe('its calls answered 401');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [500] })).toBe('its first call answered 500');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [0] })).toBe('its first call got no answer');
  expect(proofVerdict({ url: 'http://app.test/', held: true, statuses: [204, 404] })).toBeNull();
});
