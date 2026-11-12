import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { BasePage } from '../../src/web/pages/base/BasePage';

/** selects, browser messages, uploads and slow typing of utils.MethodHandlesWebForms on a small local page */
class FormProbe extends BasePage {
  byText = (t: string) => this.selectByText(By.id('city'), t, 2, 'City');
  byValue = (v: string) => this.selectByValue(By.id('city'), v, 2, 'City');
  byIndex = (i: number) => this.selectByIndex(By.id('city'), i, 2, 'City');
  press = () => this.click(By.id('ask'), 2, 'Ask');
  accept = () => this.acceptAlert(1);
  dismiss = () => this.dismissAlert(1);
  answer = (t: string) => this.typeInAlert(t, 1);
  read = () => this.alertText(1);
  upload = (name: string) => this.uploadAttachment(By.id('file'), 2, name, 'Photo');
  slowly = (t: string) => this.typeSlowly(By.id('name'), t, 20, 'Name');
}

let browser: Browser;
let page: Page;
let probe: FormProbe;
let dir: string;
const said = (p: Page) => p.locator('#said').innerText();

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  probe = new FormProbe(page);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-upload-'));
  fs.writeFileSync(path.join(dir, 'Face.png'), 'png');
  process.env.TROVA_ATTACHMENTS_DIR = dir;
});

test.afterAll(async () => {
  await browser.close();
  delete process.env.TROVA_ATTACHMENTS_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a list is chosen by its text, its value or its place', async () => {
  await page.setContent('<select id="city"><option value="c1">Cairo</option><option value="r2">Riyadh</option><option value="d3">Dubai</option></select>');
  await probe.byText('Riyadh');
  expect(await page.locator('#city').inputValue()).toBe('r2');
  await probe.byValue('d3');
  expect(await page.locator('#city').inputValue()).toBe('d3');
  await probe.byIndex(0);
  expect(await page.locator('#city').inputValue()).toBe('c1');
});

test('an option the list does not have fails in plain words', async () => {
  await page.setContent('<select id="city"><option value="c1">Cairo</option></select>');
  await expect(probe.byText('Paris')).rejects.toThrow('The City list has no option "Paris"');
  await expect(probe.byValue('x9')).rejects.toThrow('The City list has no option with the value "x9"');
  await expect(probe.byIndex(3)).rejects.toThrow('The City list has no option number 4');
});

test('a browser message is read, then accepted', async () => {
  await page.setContent(`<p id="said"></p><button id="ask" onclick="said.textContent=confirm('Delete it?')">Ask</button>`);
  await probe.press();
  expect(await probe.read()).toBe('Delete it?');
  await probe.accept();
  await expect.poll(() => said(page)).toBe('true');
});

test('a browser message is dismissed', async () => {
  await page.setContent(`<p id="said"></p><button id="ask" onclick="said.textContent=confirm('Delete it?')">Ask</button>`);
  await probe.press();
  await probe.dismiss();
  await expect.poll(() => said(page)).toBe('false');
});

test('a question gets its answer typed', async () => {
  await page.setContent(`<p id="said"></p><button id="ask" onclick="said.textContent=prompt('Your name?')">Ask</button>`);
  await probe.press();
  await probe.answer('Sara');
  await expect.poll(() => said(page)).toBe('Sara');
});

test('no browser message fails in plain words', async () => {
  await page.setContent('<p>quiet</p>');
  await expect(probe.accept()).rejects.toThrow('No browser message showed within 1 s');
});

test('a Test Data attachment is uploaded through a hidden file field', async () => {
  await page.setContent('<input id="file" type="file" style="display:none">');
  await probe.upload('face.PNG');
  expect(await page.locator('#file').evaluate((e) => (e as HTMLInputElement).files?.[0]?.name)).toBe('Face.png');
});

test('slow typing empties the field first and types key by key', async () => {
  await page.setContent(`<p id="said">0</p><input id="name" value="old" onkeydown="if (event.key.length === 1) said.textContent=Number(said.textContent)+1">`);
  await probe.slowly('Sara');
  expect(await page.locator('#name').inputValue()).toBe('Sara');
  expect(await said(page)).toBe('4');
});
