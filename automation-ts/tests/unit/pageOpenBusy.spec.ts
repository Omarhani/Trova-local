import { expect, Page, test } from '@playwright/test';
import { openPage, PageLook } from '../../src/web/pageOpen';

/**
 * run 947 case 557: on a busy computer the page's answer to "are you there?" took longer than 300 ms, so a drawn page
 * counted as the browser being slow. The browser is the edge: a page whose load never ends and whose answer is late.
 */
function busyPage(look: PageLook, answerMs: number): Page {
  const late = <T>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), answerMs));
  return {
    goto: (_url: string, o: { timeout: number }) => new Promise((_ok, fail) => setTimeout(() => fail(new Error('page load timed out')), o.timeout)),
    evaluate: () => late(look),
    context: () => ({ browser: () => null }),
  } as unknown as Page;
}

const DRAWN: PageLook = { state: 'interactive', href: 'https://app/x', hasBody: true, appStarted: true };
const LOADING: PageLook = { state: 'loading', href: 'https://app/x', hasBody: false, appStarted: false };

test('a drawn page that answers in 1 s on a busy computer opens - not the browser being slow (run 947 case 557)', async () => {
  await expect(openPage(busyPage(DRAWN, 1000), 'https://app/x', { firstMs: 200, fullMs: 6000 })).resolves.toBeUndefined();
});

test('a page that answers late but is never there still fails when its time is up (the trap)', async () => {
  const started = Date.now();
  await expect(openPage(busyPage(LOADING, 1000), 'https://app/x', { firstMs: 200, fullMs: 3000 })).rejects.toThrow('page load timed out');
  expect(Date.now() - started).toBeLessThan(6000);
});
