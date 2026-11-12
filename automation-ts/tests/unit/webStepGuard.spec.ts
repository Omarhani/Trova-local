import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { BasePage } from '../../src/web/pages/base/BasePage';
import { stepGuard } from '../../src/web/signin/signedOutStep';

/** every page action goes through the run's step guard (utils.SignedOutStep): a mid-test sign-out signs in again, once */
class GuardProbe extends BasePage {
  save = () => this.click(By.id('save'), 1, 'Save');
  name = (v: string) => this.type(By.id('name'), 1, v, 'Name');
  double = () => this.doubleClick(By.id('save'), 1, 'Save');
  city = () => this.selectByText(By.id('city'), 'Cairo', 1, 'City');
}

const SIGNED_IN = `<button id="save" onclick="said.textContent+='saved '" ondblclick="said.textContent+='double '">Save</button>
  <input id="name"><select id="city"><option>Cairo</option></select><p id="said"></p>`;
const SIGN_IN_PAGE = '<form id="signin"><input type="password"></form>';

let browser: Browser;
let page: Page;
let probe: GuardProbe;
let again = 0;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  probe = new GuardProbe(page);
});

test.beforeEach(async () => {
  again = 0;
  (stepGuard as unknown as { againDone: boolean }).againDone = false;
  stepGuard.watch(page, {
    signedOut: async (p) => (await p.locator('#signin').count()) > 0,
    signInAgain: async (p) => { again += 1; await p.setContent(SIGNED_IN); },
  }, undefined, true); // the setting that allows one fresh sign-in (Round 2: off by default)
  await page.setContent(SIGN_IN_PAGE);
});

test.afterAll(async () => {
  stepGuard.watch(undefined);
  await browser.close();
});

test('a click whose page shows the sign-in page signs in again and repeats the click once', async () => {
  await probe.save();
  expect([again, await page.locator('#said').innerText()]).toEqual([1, 'saved']);
});

test('typing on a signed-out page signs in again and types once more', async () => {
  await probe.name('Sara');
  expect([again, await page.locator('#name').inputValue()]).toEqual([1, 'Sara']);
});

test('a double click and a list choice are guarded too', async () => {
  await probe.double();
  expect(again).toBe(1);
  (stepGuard as unknown as { againDone: boolean }).againDone = false;
  await page.setContent(SIGN_IN_PAGE);
  await probe.city();
  expect([again, await page.locator('#city').inputValue()]).toEqual([2, 'Cairo']);
});

test('a page that is not signed out fails the step as before, no sign-in', async () => {
  await page.setContent('<p>other page</p>');
  await expect(probe.save()).rejects.toThrow();
  expect(again).toBe(0);
});
