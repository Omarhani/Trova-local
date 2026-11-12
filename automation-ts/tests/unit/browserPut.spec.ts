import { Browser, chromium, expect, Page, test } from '@playwright/test';
import { putState } from '../../src/web/signin/browserPut';

/**
 * Test 8094 runs 619-621: after the app had shown its sign-in page (with Google's "I'm not a robot" frame), putting the
 * next sign-in in never ended - the browser did not answer the removal of the blank-page stand-in, the test's page
 * set-up hung 5 min. A sign-in is put in within a bounded time, or fails in plain words.
 */
const ORIGIN = 'http://app.test';
const STATE = { localStorage: { token: 'kept-value' }, sessionStorage: { tab: 'one' }, cookies: {} };
const QUICK = { openMs: 400, answerMs: 400 };
const never = (): Promise<never> => new Promise<never>(() => undefined);

/** a browser tab that answers every step at once, except the ones given */
function tab(stuck: Partial<Record<'goto' | 'evaluate' | 'unroute', true>>): Page {
  const context = { clearCookies: async () => undefined, addCookies: async () => undefined };
  return {
    context: () => context,
    route: async () => undefined,
    goto: () => (stuck.goto ? never() : Promise.resolve(null)),
    evaluate: () => (stuck.evaluate ? never() : Promise.resolve(undefined)),
    unroute: () => (stuck.unroute ? never() : Promise.resolve()),
  } as unknown as Page;
}

test('a browser that never answers the stand-in removal does not hold the sign-in up', async () => {
  const start = Date.now();
  await putState(tab({ unroute: true }), STATE, ORIGIN, QUICK);
  expect(Date.now() - start).toBeLessThan(2000);
});

test('a browser that never opens the app address fails in plain words, in time', async () => {
  const start = Date.now();
  await expect(putState(tab({ goto: true }), STATE, ORIGIN, QUICK)).rejects.toThrow(/did not open the app's address within/);
  expect(Date.now() - start).toBeLessThan(2000);
});

test('a browser that never takes the sign-in fails in plain words, in time', async () => {
  const start = Date.now();
  await expect(putState(tab({ evaluate: true }), STATE, ORIGIN, QUICK)).rejects.toThrow(/did not take the sign-in within/);
  expect(Date.now() - start).toBeLessThan(2000);
});

test.describe('in a real browser', () => {
  let browser: Browser;
  test.beforeAll(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
  test.afterAll(async () => { await browser.close(); });

  test('the sign-in is in the app origin storage and the stand-in page is gone after', async () => {
    const page = await browser.newPage();
    await putState(page, STATE, ORIGIN);
    expect(await page.evaluate(() => [localStorage.getItem('token'), sessionStorage.getItem('tab')])).toEqual(['kept-value', 'one']);
    const served = await page.goto(`${ORIGIN}/trova-sign-in`, { timeout: 5000 }).then(() => 'stand-in', () => 'not served');
    expect(served).toBe('not served'); // no stand-in left behind: app.test is not a real address
  });
});
