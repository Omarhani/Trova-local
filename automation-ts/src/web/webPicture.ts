import { CDPSession, Page } from '@playwright/test';

/**
 * The browser's step pictures at 720p (Java's size, utils.BrowserGifRecorder: 1920 x 1080 becomes 1280 x 720) and JPEG 80 -
 * Omar 2026-11-10: sharp at 720p, never smaller (JPEG 60 looked blurry); 180 KB a full-window JPEG 75 was too costly.
 */
export const WEB_PICTURE = { width: 1280, quality: 80 } as const;

const devTools = new WeakMap<Page, Promise<CDPSession | undefined>>();

function devToolsOf(page: Page): Promise<CDPSession | undefined> {
  let s = devTools.get(page);
  if (!s) {
    s = page.context().newCDPSession(page).catch(() => undefined);
    devTools.set(page, s);
  }
  return s;
}

/** the window's picture, no wider than WEB_PICTURE.width (Chrome / Edge scale it while taking it; others as they are) */
export async function webShot(page: Page, timeout = 5000): Promise<Buffer> {
  const chromium = page.context().browser()?.browserType().name() === 'chromium';
  const cdp = chromium ? await devToolsOf(page) : undefined;
  if (!cdp) return page.screenshot({ type: 'jpeg', quality: WEB_PICTURE.quality, timeout });
  const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, x: window.scrollX, y: window.scrollY }));
  const scale = Math.min(1, WEB_PICTURE.width / view.w);
  const shot = cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: WEB_PICTURE.quality,
    clip: { x: view.x, y: view.y, width: view.w, height: view.h, scale } });
  shot.catch(() => undefined); // a picture answered after its time is let go
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, no) => { timer = setTimeout(() => no(new Error(`No picture within ${timeout} ms`)), timeout); });
  try {
    return Buffer.from((await Promise.race([shot, late])).data, 'base64');
  } finally {
    clearTimeout(timer);
  }
}
