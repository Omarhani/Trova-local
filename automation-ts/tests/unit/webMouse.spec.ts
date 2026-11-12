import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { BasePage } from '../../src/web/pages/base/BasePage';

/** the mouse actions of utils.MethodHandlesWebClicks on a small local page (installed Chrome, hidden) */
class MouseProbe extends BasePage {
  double = (s: string) => this.doubleClick(s, 2, 'Row');
  right = (s: string) => this.rightClick(s, 2, 'Row');
  hold = (s: string) => this.clickAndHold(s, 2, 'Handle');
  letGo = () => this.release();
  over = (s: string) => this.hover(s, 2, 'Menu');
  drag = (from: string, to: string) => this.dragAndDrop(from, to, 2, 'Card', 'Done column');
  inModal = (s: string) => this.scrollToElementInModal(s, 2);
  send = (s: string) => this.submit(s, 2, 'Search');
  escape = () => this.pressEscape();
}

let browser: Browser;
let page: Page;
let probe: MouseProbe;
const said = (p: Page) => p.locator('#said').innerText();

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  probe = new MouseProbe(page);
});

test.afterAll(async () => {
  await browser.close();
});

test('double click and right click reach the element', async () => {
  await page.setContent(`<p id="said"></p><div id="row" ondblclick="said.textContent='double'"
    oncontextmenu="said.textContent+=' right';return false">Row</div>`);
  await probe.double(By.id('row'));
  await probe.right(By.id('row'));
  expect(await said(page)).toBe('double right');
});

test('click and hold keeps the button down until release', async () => {
  await page.setContent(`<div id="h" style="width:80px;height:40px" onmousedown="said.textContent='down'"
    onmouseup="said.textContent+=' up'">Handle</div><p id="said"></p>`);
  await probe.hold(By.id('h'));
  expect(await said(page)).toBe('down');
  await probe.letGo();
  expect(await said(page)).toBe('down up');
});

test('hover moves the mouse over the element', async () => {
  await page.setContent(`<p id="said"></p><div id="m" style="width:80px;height:40px" onmouseenter="said.textContent='over'">Menu</div>`);
  await probe.over(By.id('m'));
  expect(await said(page)).toBe('over');
});

test('drag and drop lets go over the target', async () => {
  await page.setContent(`<div id="card" style="width:80px;height:40px" onmousedown="said.textContent='took'">Card</div>
    <div id="done" style="width:200px;height:80px;margin-top:100px" onmouseup="said.textContent+=' dropped'">Done</div><p id="said"></p>`);
  await probe.drag(By.id('card'), By.id('done'));
  expect(await said(page)).toBe('took dropped');
});

test('an element far down inside a modal is scrolled into its middle', async () => {
  await page.setContent(`<div id="modal" style="height:100px;overflow:auto"><div style="height:2000px"></div><b id="far">far</b></div>`);
  await probe.inModal(By.id('far'));
  expect(await page.locator('#modal').evaluate((m) => m.scrollTop)).toBeGreaterThan(1000);
});

test("submit sends the field's form; a field outside a form fails in plain words", async () => {
  await page.setContent(`<p id="said"></p><form onsubmit="said.textContent='sent';return false"><input id="q"></form><input id="alone">`);
  await probe.send(By.id('q'));
  await expect.poll(() => said(page)).toBe('sent');
  await expect(probe.send(By.id('alone'))).rejects.toThrow('Search is not in a form - there is nothing to send');
});

test('Escape is pressed on the page', async () => {
  await page.setContent(`<p id="said"></p><script>document.onkeydown = (e) => { said.textContent = e.key; };</script>`);
  await probe.escape();
  expect(await said(page)).toBe('Escape');
});

test('an element that never shows fails in plain words', async () => {
  await page.setContent('<p>nothing</p>');
  await expect(probe.double(By.id('row'))).rejects.toThrow('Row did not show within 2 s');
});
