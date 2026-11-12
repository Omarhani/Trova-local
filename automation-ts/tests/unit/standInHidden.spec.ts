import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { FACTS, LAST_SCREEN } from '../../src/report/failureFacts';
import { wantedCall } from '../../src/report/networkEvents';
import { keepTestEnd } from '../../src/web/lastScreen';
import { onStandIn, standInAddress } from '../../src/web/signin/standIn';
import { stepPictures } from '../../src/web/stepPictures';

/**
 * Trova's blank stand-in page (where a kept sign-in is put in before the app opens) is ours, on any app: customers
 * never see it - no open / call event, no live or step picture, no last screen, no address in the failure facts.
 */
const ORIGIN = 'http://app.test';

test('the stand-in address is known on any app; app pages are not it', () => {
  expect(onStandIn(standInAddress(ORIGIN))).toBe(true);
  expect(onStandIn('https://availo-testingnewui.t2.sa/trova-sign-in?x=1')).toBe(true);
  expect(onStandIn('https://other.app/trova-sign-in#/a')).toBe(true);
  expect(onStandIn('https://availo-testingnewui.t2.sa/calendar-shifts')).toBe(false);
  expect(onStandIn('https://a.sa/sign-in')).toBe(false);
  expect(onStandIn('about:blank')).toBe(false);
});

test('opening or calling the stand-in is never a Network event', () => {
  expect(wantedCall('document', 'https://a.sa/trova-sign-in', 'GET')).toBe(false);
  expect(wantedCall('fetch', 'https://a.sa/trova-sign-in?y=2', 'GET')).toBe(false);
  expect(wantedCall('document', 'https://a.sa/home', 'GET')).toBe(true);
});

test.describe('in a real browser', () => {
  let browser: Browser;
  let page: Page;
  test.beforeAll(async () => {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage();
    await page.route(standInAddress(ORIGIN), (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><nav><a>x</a></nav></html>' }));
    await page.goto(standInAddress(ORIGIN));
  });
  test.afterAll(async () => {
    stepPictures.keepWith(undefined);
    await browser.close();
  });

  test('no step or live picture is taken while on the stand-in', async () => {
    const kept: number[] = [];
    stepPictures.keepWith(async (_shot, step) => { kept.push(step); }, async () => Buffer.from('jpg'));
    stepPictures.shoot(page, 7);
    await stepPictures.done(page);
    expect(kept).toEqual([]);
  });

  test('no last screen and no stand-in address in the failure facts', async () => {
    const got: { name: string; body: string | Buffer }[] = [];
    await keepTestEnd(page, async (name, a) => { got.push({ name, body: a.body }); }, true);
    expect(got.map((g) => g.name)).not.toContain(LAST_SCREEN);
    const facts = got.find((g) => g.name === FACTS);
    expect(String(facts?.body ?? '')).not.toContain('trova-sign-in');
  });
});
