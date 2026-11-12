import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { stepPictures } from '../../src/web/stepPictures';
import { WebActions } from '../../src/web/webActions';

/** run 947 case 558: a step whose element showed at the end of its wait gave the click itself 1 ms */
class LateProbe extends WebActions {
  save = () => this.click(By.id('save'), 2, 'Save');
  name = (v: string) => this.type(By.id('box'), 2, v, 'Name');
}

let browser: Browser;
let page: Page;
let probe: LateProbe;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  probe = new LateProbe(page);
  stepPictures.keepWith(async () => undefined, async () => Buffer.from('jpg'));
});

test.afterAll(async () => {
  stepPictures.keepWith(undefined);
  await browser.close();
});

/** the element shows at showMs (near the end of the 2 s wait) and is ready for the action only at readyMs */
async function lateElement(showMs: number, readyMs: number): Promise<void> {
  await page.setContent(`<p id="said"></p>
    <button id="save" disabled style="display:none" onclick="said.textContent='saved'">Save</button>
    <input id="box" readonly style="display:none">
    <script>
      setTimeout(() => { save.style.display = ''; box.style.display = ''; }, ${showMs});
      setTimeout(() => { save.disabled = false; box.readOnly = false; }, ${readyMs});
    </script>`);
}

test('an element shown at the end of the wait still gets a real time for the click (run 947 case 558)', async () => {
  await lateElement(1500, 2600);
  await probe.save();
  expect(await page.locator('#said').innerText()).toBe('saved');
});

test('an element shown at the end of the wait still gets a real time for the typing', async () => {
  await lateElement(1500, 2600);
  await probe.name('Omar');
  expect(await page.locator('#box').inputValue()).toBe('Omar');
});

test('an element that never shows still fails within its own wait - the floor is only for the action', async () => {
  await page.setContent('<p>nothing here</p>');
  const started = Date.now();
  await expect(probe.save()).rejects.toThrow();
  expect(Date.now() - started).toBeLessThan(15_000);
});
