import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { openPage, openWithOneRetry, pageIsThere } from '../../src/web/pageOpen';

/** utils.PageOpen / BrowserStart.openWithOneRetry on a small local server (installed Chrome, hidden) */
let browser: Browser;
let page: Page;
let server: http.Server;
let at = '';

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  server = http.createServer((req, res) => {
    if (req.url === '/slow-part' || req.url === '/never') return; // never answers
    if (req.url === '/main.js') return void setTimeout(() => { // the app's own script, slow to come (run 901)
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end("document.querySelector('app-root').innerHTML = '<h1>Started</h1>';");
    }, 1500);
    res.writeHead(200, { 'content-type': 'text/html' });
    if (req.url === '/app') return void res.end('<html><body><div id="global-loader">...</div><app-root></app-root>'
      + '<script type="module" src="/main.js"></script></body></html>');
    res.end('<html><body><app-root><h1>Here</h1></app-root><img src="/slow-part"></body></html>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  at = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await browser.close();
  server.closeAllConnections();
  server.close();
});

test('the page is there when complete, on an app address, with content (utils.PageOpen)', () => {
  expect(pageIsThere({ state: 'complete', href: 'https://app/x', hasBody: true, appStarted: false })).toBe(true);
  expect(pageIsThere({ state: 'loading', href: 'https://app/x', hasBody: true, appStarted: true })).toBe(false);
  expect(pageIsThere({ state: 'complete', href: 'about:blank', hasBody: true, appStarted: true })).toBe(false);
  expect(pageIsThere({ state: 'complete', href: 'https://app/x', hasBody: false, appStarted: false })).toBe(false);
});

test('a page still coming counts as there only once the app has started (run 901: loader and empty app only)', () => {
  expect(pageIsThere({ state: 'interactive', href: 'https://app/x', hasBody: true, appStarted: false })).toBe(false);
  expect(pageIsThere({ state: 'interactive', href: 'https://app/x', hasBody: true, appStarted: true })).toBe(true);
});

test("the app's own slow script is never stopped: the app starts (run 901 case 557)", async () => {
  await openPage(page, `${at}/app`, { firstMs: 300, fullMs: 5000 });
  await expect(page.locator('app-root h1')).toHaveText('Started', { timeout: 3000 });
});

test('a page whose slow part never ends goes on after the first wait, its content there', async () => {
  const started = Date.now();
  await openPage(page, `${at}/`, { firstMs: 700, fullMs: 5000 });
  expect(Date.now() - started).toBeLessThan(4000);
  expect(await page.locator('h1').innerText()).toBe('Here');
});

test('a page that never comes is the slow browser, retried once', async () => {
  const said: string[] = [];
  await expect(openWithOneRetry(page, `${at}/never`, { firstMs: 300, fullMs: 800 }, (l) => said.push(l)))
    .rejects.toThrow('The browser was slow - retried once, it was still slow');
  expect(said).toEqual(['The browser was slow - retried once']);
});

test('no web address fails in plain words', async () => {
  await expect(openWithOneRetry(page, ' ')).rejects.toThrow('No web address for the Test environment: add it in Trova > Test Data > Environments');
});
