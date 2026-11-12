import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { byLabel } from '../../src/web/labelledValues';
import { readSwitchFacts, switchIsOn } from '../../src/web/switchState';

/** the browser-side reads on a small local page (installed Chrome, hidden) */
let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('a value is read next to its label, by the label for a field, or "" when the label is not there', async () => {
  await page.setContent(`<div><div class="row"><span>بداية الدوام</span><span>10:00</span></div>
    <p><label for="f">Name:</label> <input id="f" value="Trova"> <span>hint</span></p></div>`);
  expect(await byLabel(page, 1, 'بداية الدوام')).toBe('10:00');
  expect(await byLabel(page, 1, 'name')).toBe('Trova');
  expect(await byLabel(page, 1, 'نهاية الدوام')).toBe('');
});

test('a switch is read in the page: aria-checked, a native checkbox, an inner input', async () => {
  await page.setContent(`<div id="a" aria-checked="true"></div><input id="b" type="checkbox">
    <div id="c"><input type="checkbox" checked></div>`);
  expect(switchIsOn(await page.locator('#a').evaluate(readSwitchFacts))).toBe(true);
  expect(switchIsOn(await page.locator('#b').evaluate(readSwitchFacts))).toBe(false);
  expect(switchIsOn(await page.locator('#c').evaluate(readSwitchFacts))).toBe(true);
});
