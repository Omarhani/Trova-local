import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { BasePage } from '../../src/web/pages/base/BasePage';

/**
 * Test 8094 run 631 case 5: the employee list's search box sits inside a list row the app marks aria-disabled, so a
 * plain fill waited 10 s for it to be "enabled". The box itself is enabled: it is typed into as Java's sendKeys does.
 * A box that is itself disabled or read-only still fails as it did.
 */
class SearchProbe extends BasePage {
  search = (t: string) => this.type(By.id('search'), 2, t, 'Employee search');
}

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('a search box inside a disabled list row is typed into (run 631)', async () => {
  await page.setContent('<div role="listbox"><div role="option" aria-disabled="true"><input id="search" value="old"></div></div>');
  await new SearchProbe(page).search('E-1042');
  expect(await page.locator('#search').inputValue()).toBe('E-1042');
});

test('a box that is itself disabled still fails as that step', async () => {
  await page.setContent('<input id="search" disabled>');
  await expect(new SearchProbe(page).search('E-1042')).rejects.toThrow(/Timeout|not enabled|did not/i);
});
