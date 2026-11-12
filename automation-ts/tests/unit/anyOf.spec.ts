import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { anyOf, locate } from '../../src/web/anyOf';
import { By } from '../../src/web/by';

/** utils.AnyOf on a small local page (installed Chrome, hidden) */
let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
});

test.afterAll(async () => {
  await browser.close();
});

test('AnyOf needs at least one locator; one locator is itself', () => {
  expect(() => anyOf()).toThrow('AnyOf needs at least one locator');
  expect(anyOf(By.xpath("//button[@id='a']"))).toBe("xpath=//button[@id='a']");
});

test('the first locator that matches on the page now wins, even when a later one comes first on the page', async () => {
  await page.setContent('<a class="side">side</a><button id="top">top</button>');
  const menu = anyOf(By.xpath("//button[@id='top']"), By.xpath("//a[contains(@class,'side')]"));
  expect(await page.locator(menu).first().innerText()).toBe('top');
  expect(await page.locator(menu).count()).toBe(1);
});

test('the next design is used when the first is not on the page', async () => {
  await page.setContent('<a class="side">side</a>');
  const menu = anyOf(By.xpath("//button[@id='top']"), By.xpath("//a[contains(@class,'side')]"), By.id('third'));
  expect(await page.locator(menu).first().innerText()).toBe('side');
});

test('a CSS locator works in it too (through locate)', async () => {
  await page.setContent('<nav><span class="item">css one</span></nav>');
  const menu = anyOf(By.xpath("//button[@id='top']"), By.cssSelector('nav .item'));
  expect(await locate(page, menu).first().innerText()).toBe('css one');
});

test('none on the page = no match', async () => {
  await page.setContent('<p>nothing</p>');
  expect(await page.locator(anyOf(By.xpath('//button'), By.xpath('//a'))).count()).toBe(0);
});
