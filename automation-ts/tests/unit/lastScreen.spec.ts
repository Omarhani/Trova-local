import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { FACTS, LAST_SCREEN } from '../../src/report/failureFacts';
import { keepTestEnd } from '../../src/web/lastScreen';

/** base.BaseTests: the last screen of every web test is kept, passed or failed; the page facts only for a failure */
let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  await page.setContent('<nav><a>Home</a></nav>');
});

test.afterAll(async () => {
  await browser.close();
});

function recorder(): { names: string[]; attach: (name: string, a: { body: string | Buffer; contentType: string }) => Promise<void> } {
  const names: string[] = [];
  return { names, attach: async (name) => { names.push(name); } };
}

test('a passed test keeps its last screen, no failure facts', async () => {
  const r = recorder();
  await keepTestEnd(page, r.attach, false);
  expect(r.names).toEqual([LAST_SCREEN]);
});

test('a failed test keeps its facts and its last screen', async () => {
  const r = recorder();
  await keepTestEnd(page, r.attach, true);
  expect(r.names).toEqual([FACTS, LAST_SCREEN]);
});

test('a browser that cannot give a picture leaves only the facts', async () => {
  const gone = await browser.newPage();
  await gone.close();
  const r = recorder();
  await keepTestEnd(gone, r.attach, true);
  expect(r.names).toEqual([FACTS]);
});
