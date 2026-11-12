import { Browser, chromium, expect, test } from '@playwright/test';
import { coveredNow, settle } from '../../src/web/covers';

/**
 * Test 8094 run 684, case 5: the movements page keeps its loading layer (.ngx-spinner-overlay) in the page at opacity 0
 * when idle (Java TransactionManagementPage: "Always in the DOM, opacity 0 when idle" - Selenium's invisibility check
 * counts it as gone). Playwright's isVisible ignores opacity, so the page looked covered forever: the list answered
 * 3 s after "Show again" and the case waited 60 s and was BLOCKED. A layer counts only while it can be seen.
 */

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
test.afterAll(async () => { await browser.close(); });

const PAGE = (style: string) => `<html><body><div class="ngx-spinner-overlay" style="position:fixed;inset:0;${style}"></div><h1>list</h1></body></html>`;

test('an idle layer at opacity 0 (or inside a parent at opacity 0) does not cover the page; a shown one does', async () => {
  const page = await browser.newPage();
  await page.setContent(PAGE('opacity:0'));
  expect(await coveredNow(page)).toBe(false);
  await page.setContent(`<div style="opacity:0">${PAGE('')}</div>`);
  expect(await coveredNow(page)).toBe(false);
  await page.setContent(PAGE('visibility:hidden'));
  expect(await coveredNow(page)).toBe(false);
  await page.setContent(PAGE('opacity:1;background:#0003'));
  expect(await coveredNow(page)).toBe(true);
  await page.close();
});

test('the page settles at once when its idle layer is at opacity 0 - no wait to the limit', async () => {
  const page = await browser.newPage();
  await page.setContent(PAGE('opacity:0'));
  const started = Date.now();
  await settle(page, 5000);
  expect(Date.now() - started).toBeLessThan(1500);
  await page.close();
});
