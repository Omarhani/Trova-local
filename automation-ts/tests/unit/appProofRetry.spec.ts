import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { proveSignedIn } from '../../src/web/signin/appProof';

/**
 * Test 8094 run 960 case 529: the app's address answered in 0.3 s but its scripts did not come within 30 s, and the case
 * was BLOCKED with no second try. Java's goHomeWeb (openWithOneRetry) stops a hung load and opens the address once more;
 * the proof's open does the same.
 */
const WEB = 'http://app.test/';
const PAGE = `<html><body><nav><a href="#/a">One</a></nav><script type="module" src="/main.js"></script></body></html>`;
let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('a load that hangs the first time is stopped and opened once more, then proved', async () => {
  let scripts = 0;
  await page.route(WEB, (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.route('http://app.test/main.js', async (r) => {
    scripts += 1;
    if (scripts === 1) return; // the first load of the app's script never comes
    await r.fulfill({ contentType: 'text/javascript', body: "fetch('/api/me');" });
  });
  await page.route('http://app.test/api/me', (r) => r.fulfill({ status: 200, body: '{}' }));

  expect(await proveSignedIn(page, WEB, { openMs: 1500 })).toBeNull();
  expect(scripts).toBe(2);
});
