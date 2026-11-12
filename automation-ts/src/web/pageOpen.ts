import { Page } from '@playwright/test';
import { testData } from '../run/testData';
import { retryOnce } from './browserSlow';

/** how long a page open waits for the whole page, then for the page itself (utils.PageOpen) */
export interface OpenWaits {
  firstMs: number;
  fullMs: number;
}

export const OPEN_WAITS: OpenWaits = { firstMs: 10_000, fullMs: 30_000 };

/** what the page says of itself */
export interface PageLook {
  state: string;
  href: string;
  hasBody: boolean;
  /** the app has drawn itself: its <app-root> holds something (an empty one is only the loading spinner) */
  appStarted: boolean;
}

/**
 * the page itself is there: on an app address, with content, and either fully loaded or its app started - run 901 case
 * 557: past "loading" the body held only the loader and an empty app, and stopping then cut off the app's own script
 */
export function pageIsThere(look: PageLook): boolean {
  return look.state !== 'loading' && look.href.startsWith('http') && look.hasBody && (look.state === 'complete' || look.appStarted);
}

/** a browser call that may not answer while a page is still coming: undefined after ms */
function quick<T>(call: Promise<T>, ms = 300): Promise<T | undefined> {
  return Promise.race([call.catch(() => undefined), new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

/** how long the page may take to say whether it is there: 300 ms was too short on a busy computer (run 947 case 557) */
export const LOOK_MS = 2_000;

const look = (page: Page): Promise<PageLook | undefined> => quick(page.evaluate(() => ({
  state: document.readyState, href: location.href, hasBody: !!(document.body && document.body.children.length),
  appStarted: !!document.querySelector('app-root')?.children.length })), LOOK_MS);

/** stops the page's loading: Chrome / Edge through DevTools (a script cannot run while a page is still coming), else window.stop */
export async function stop(page: Page): Promise<void> {
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const devTools = await page.context().newCDPSession(page).catch(() => undefined);
    if (devTools) {
      await quick(devTools.send('Page.stopLoading'), 2000);
      await devTools.detach().catch(() => undefined);
      return;
    }
  }
  await quick(page.evaluate(() => window.stop()));
}

/**
 * Opens url waiting at most firstMs for the whole page; past that, as soon as the page itself is there its slow rest is
 * stopped and the test goes on (its own checks still decide). A page not there within fullMs is never stopped half-way:
 * it fails as the browser being slow, and openWithOneRetry loads it once more.
 */
export async function openPage(page: Page, url: string, waits: OpenWaits = OPEN_WAITS): Promise<void> {
  const deadline = Date.now() + waits.fullMs;
  const first = Math.min(waits.firstMs, waits.fullMs);
  const going = page.goto(url, { waitUntil: 'load', timeout: waits.fullMs }).then(() => 'loaded' as const, (e: unknown) => e);
  const firstWait = new Promise<'waited'>((r) => setTimeout(() => r('waited'), first));
  const early = await Promise.race([going, firstWait]);
  if (early === 'loaded') return;
  if (early !== 'waited') throw early;
  while (Date.now() < deadline) {
    const now = await look(page);
    if (now && pageIsThere(now)) {
      await stop(page);
      console.log('The page was there; a slow part of it was stopped so the test goes on');
      return;
    }
    const done = await Promise.race([going, new Promise<'poll'>((r) => setTimeout(() => r('poll'), 200))]);
    if (done === 'loaded') return;
    if (done !== 'poll') throw done;
  }
  const end = await going; // its own page-load time ends it, so a second open never meets it
  if (end !== 'loaded') throw end;
}

/** opens the app's page; a hung load is stopped and loaded once more (base.BrowserStart.openWithOneRetry) */
export async function openWithOneRetry(page: Page, url: string, waits: OpenWaits = OPEN_WAITS,
                                       say: (line: string) => void = console.log): Promise<void> {
  if (!url.trim()) throw new Error(`No web address for the ${testData.env()} environment: add it in Trova > Test Data > Environments`);
  await retryOnce(() => openPage(page, url, waits), say, () => stop(page));
}
