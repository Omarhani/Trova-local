import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { By } from '../../src/web/by';
import { BasePage } from '../../src/web/pages/base/BasePage';

/** a web Type step carries its value; a password box's step carries *** and its reference only (run 633) */
class FormProbe extends BasePage {
  name = (v: string) => this.type(By.id('name'), 2, v, 'First name');
  pw = (v: string) => this.type(By.id('pw'), 2, v, 'Field');
}

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage();
  await page.setContent('<input id="name"><input id="pw" type="password">');
});

test.afterAll(async () => {
  await browser.close();
});

async function events(act: () => Promise<void>): Promise<Record<string, unknown>[]> {
  const lines: string[] = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: string) => { lines.push(String(s)); return true; }) as typeof process.stdout.write;
  try {
    await act();
  } finally {
    process.stdout.write = write;
  }
  return lines.filter((l) => l.startsWith('@@live ')).map((l) => JSON.parse(l.slice(7)));
}

test('a Type step carries the typed value', async () => {
  const got = await events(() => new FormProbe(page).name('Ali'));
  expect(got.find((e) => e.t === 'step')).toMatchObject({ a: 'type', e: 'First name', v: 'Ali' });
});

test('a password box: the step has *** and a reference; the value is nowhere in what the run prints', async () => {
  delete process.env.TROVA_SECRET_CHANNEL;
  const got = await events(() => new FormProbe(page).pw('Pa55word!'));
  expect(got.find((e) => e.t === 'step')).toMatchObject({ a: 'type', v: '***', secret: true });
  expect(JSON.stringify(got)).not.toContain('Pa55word!');
  expect(await page.locator('#pw').inputValue()).toBe('Pa55word!');
});

test("with Trova's secret channel on, the value goes once as a secret line, by its reference", async () => {
  process.env.TROVA_SECRET_CHANNEL = '1';
  try {
    const got = await events(() => new FormProbe(page).pw('Qq7?other'));
    const step = got.find((e) => e.t === 'step');
    const secret = got.find((e) => e.t === 'secret');
    expect(secret).toMatchObject({ ref: step?.ref, v: 'Qq7?other' });
    expect(JSON.stringify(step)).not.toContain('Qq7?other');
  } finally {
    delete process.env.TROVA_SECRET_CHANNEL;
  }
});
