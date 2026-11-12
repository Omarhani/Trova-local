import { Browser, chromium, expect, test } from '@playwright/test';
import { keepTestEnd } from '../../src/web/lastScreen';

/**
 * Test 8094 run 688, case 8: the app hung on /leaves ("Starting", its script busy) and the case failed in 20 s - then
 * its end waited minutes: reading the page's menu and taking its picture never answered. Both now have a limit.
 */
let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
test.afterAll(async () => { await browser.close(); });

test('a page whose own script hangs: the case end is told and kept within its limit', async () => {
  const page = await browser.newPage();
  await page.setContent('<html><body><h1>Starting</h1></body></html>');
  void page.evaluate(() => { setTimeout(() => { for (;;) { /* the app's script never gives the page back */ } }, 0); }).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 200));
  const kept: Array<{ name: string; body: string }> = [];
  const started = Date.now();
  await keepTestEnd(page, async (name, a) => { kept.push({ name, body: String(a.body) }); }, true, 1500);
  expect(Date.now() - started).toBeLessThan(8000);
  expect(kept.find((k) => k.name === 'failure facts')?.body).toContain('did not answer');
});
