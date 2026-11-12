import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Browser, chromium, Page } from '@playwright/test';
import { freePort } from '../core/freePort';
import { emit } from '../report/liveEvents';
import { browserChoice, pickedBrowser } from './browserChoice';
import { cacheRoot, claimCache } from './browserCache';
import { stopBrowser } from './browserStop';
import { browserUp } from './browserUp';
import { chromeArgs, chromePath } from './chromePath';
import { openBrowser } from './signedInBrowser';
import { watchNetwork } from './networkFeed';
import { watchPageMessages } from './pageMessages';
import { forgetHeld } from './signin/heldLogin';

/** where the run's one browser listens (set by the run's set-up, read by every block) */
export const SHARED = 'TROVA_BROWSER_CDP';

/** the window size of the run (TROVA_WINDOW_SIZE "1920x1080"), the Java default otherwise */
export function viewport(): { width: number; height: number } {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(process.env.TROVA_WINDOW_SIZE ?? '');
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1920, height: 1080 };
}

/**
 * The run's ONE browser, as the Java suites keep one for the whole suite (Test 8094 run 592: a browser, sign-in and first
 * page per block cost +3..7 s a block): started once before the first block with its DevTools address, which goes to
 * the run screen as the live Browser view ("cdp", like utils.LiveFeed.browser). Gives back how to close it after the run.
 */
export async function startSharedBrowser(): Promise<() => Promise<void>> {
  forgetHeld();
  const choice = browserChoice(pickedBrowser());
  if (choice.engine !== 'chromium') return async () => undefined; // Firefox / Safari: each block opens its own
  const exe = chromePath(pickedBrowser(), process.platform, process.env, (f) => fs.existsSync(f));
  if (!exe) return async () => undefined; // no installed browser found: each block opens its own, as before
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-browser-'));
  const cache = claimCache(cacheRoot());
  const chrome = spawn(exe, chromeArgs(port, profile, viewport(), choice.headless, cache?.dir), { stdio: 'ignore', windowsHide: true });
  const at = `http://127.0.0.1:${port}`;
  process.env[SHARED] = at;
  // the first block starts while the browser starts (run 615: its blocks waited for it); the run screen gets it once up,
  // and a block waits for it when it joins - not up = that block says so in plain words
  let ending = false;
  const up = browserUp(at, 30_000, () => ending).then(() => emit('cdp', { addr: `127.0.0.1:${port}` }), () => undefined);
  return async () => {
    ending = true;
    await up; // its last look done: nothing open to the browser when it stops
    emit('screen-off');
    await stopBrowser(chrome, { waitMs: 10_000, release: () => cache?.release(),
      removeProfile: () => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }) });
  };
}

/** a block's hold on the run's browser (a browser of its own when the run has none - a local try) */
export async function joinSharedBrowser(): Promise<{ browser: Browser; own: boolean }> {
  const at = process.env[SHARED];
  if (!at) {
    forgetHeld();
    return { browser: await openBrowser(), own: true };
  }
  try {
    await browserUp(at, 10_000);
    return { browser: await chromium.connectOverCDP(at, { timeout: 15_000 }), own: false };
  } catch {
    // run 747: the run's browser froze with the app's page - this block opens a browser of its own, signed in from the run's sign-in
    emit('log', { text: "The run's browser stopped answering - this part opened a browser of its own" });
    forgetHeld();
    return { browser: await openBrowser(), own: true };
  }
}

/** the run's one tab: kept from block to block, its calls and console watched for the run screen */
export async function sharedTab(browser: Browser): Promise<Page> {
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = context.pages()[0] ?? await context.newPage();
  await page.setViewportSize(viewport());
  watchNetwork(page);
  await watchPageMessages(page); // run 881: every message the page shows is kept with the case
  return page;
}
