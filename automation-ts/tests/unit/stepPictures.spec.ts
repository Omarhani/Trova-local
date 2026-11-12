import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { checkTrue } from '../../src/report/checks';
import { currentStep } from '../../src/report/stepNumbers';
import { By } from '../../src/web/by';
import { picturesAfterChecks, stepPictures } from '../../src/web/stepPictures';
import { WebActions } from '../../src/web/webActions';

/** what a picture showed: the step's box and click point (where), or none */
interface Seen {
  step: number;
  boxes: number;
  points: number;
  box?: { x: number; y: number; w: number; h: number };
  point?: { x: number; y: number };
}

class MarkProbe extends WebActions {
  save = () => this.click(By.id('save'), 2, 'Save');
  name = (v: string) => this.type(By.id('name'), 2, v, 'Name');
}

const MARKS = `(() => {
  const box = document.querySelector('.__trova_box'), point = document.querySelector('.__trova_point');
  const r = (e) => { const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
  const p = point ? r(point) : undefined;
  return { boxes: document.querySelectorAll('.__trova_box').length, points: document.querySelectorAll('.__trova_point').length,
    box: box ? r(box) : undefined, point: p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : undefined };
})()`;

let browser: Browser;
let page: Page;
let probe: MarkProbe;
let seen: Seen[];

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  probe = new MarkProbe(page);
});

test.beforeEach(async () => {
  seen = [];
  stepPictures.keepWith(async (_shot, step) => { seen[seen.length - 1].step = step; },
    async (p) => { seen.push({ step: -1, ...(await p.evaluate(MARKS)) as Omit<Seen, 'step'> }); return Buffer.from('jpg'); });
  await page.setContent(`<p id="said"></p>
    <button id="save" style="position:absolute;left:100px;top:200px;width:120px;height:40px" onclick="said.textContent+='saved '">Save</button>
    <input id="name" style="position:absolute;left:100px;top:300px;width:200px">`);
});

test.afterAll(async () => {
  stepPictures.keepWith(undefined);
  await browser.close();
});

test("a click step's picture shows a box around the element and a mark at the click point; the click goes through once", async () => {
  await probe.save();
  await stepPictures.done(page);
  expect(seen).toHaveLength(1);
  const [shot] = seen;
  expect(shot.boxes).toBe(1);
  expect(shot.points).toBe(1);
  expect(shot.box!.x).toBeLessThan(100);
  expect(shot.box!.x + shot.box!.w).toBeGreaterThan(220);
  expect(Math.round(shot.point!.x)).toBe(160);
  expect(Math.round(shot.point!.y)).toBe(220);
  expect(await page.locator('#said').innerText()).toBe('saved');
});

test("a typing step's picture shows the box only - no click mark", async () => {
  await probe.name('Omar');
  await stepPictures.done(page);
  expect(seen.map((s) => [s.boxes, s.points])).toEqual([[1, 0]]);
  expect(await page.locator('#name').inputValue()).toBe('Omar');
});

test('the marks are drawn only for the picture: gone once it is taken, never read as page text', async () => {
  await probe.save();
  await stepPictures.done(page);
  expect(await page.evaluate(MARKS)).toMatchObject({ boxes: 0, points: 0 });
  expect(await page.locator("xpath=//*[contains(normalize-space(),'click')]").count()).toBe(0);
});

test('every step and every check gets its own picture, numbered as its line - none left out for being quick', async () => {
  const stop = picturesAfterChecks(page);
  const first = currentStep() + 1;
  await probe.save();
  await probe.save();
  await probe.name('Omar');
  checkTrue('Save · said', true);
  stop();
  await stepPictures.done(page);
  expect(seen.map((s) => s.step)).toEqual([first, first + 1, first + 2, first + 3]);
  expect(await page.locator('#said').innerText()).toBe('saved saved');
});

test('a run without pictures draws no mark and takes no picture', async () => {
  stepPictures.keepWith(undefined);
  await probe.save();
  await stepPictures.done(page);
  expect(seen).toHaveLength(0);
  expect(await page.evaluate(MARKS)).toMatchObject({ boxes: 0, points: 0 });
});
