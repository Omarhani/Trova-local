import { chromium, expect, test } from '@playwright/test';
import { WEB_PICTURE, webShot } from '../../src/web/webPicture';

/** a JPEG's width and height, read from its frame header */
function size(jpeg: Buffer): { width: number; height: number } {
  for (let i = 2; i < jpeg.length;) {
    const marker = jpeg[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return { height: jpeg.readUInt16BE(i + 5), width: jpeg.readUInt16BE(i + 7) };
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  return { width: 0, height: 0 };
}

test("the browser's step pictures are 720p at JPEG 80 (Omar 2026-11-10: sharp at 720p, never smaller)", () => {
  expect(WEB_PICTURE).toEqual({ width: 1280, quality: 80 });
});

test('a 1920 x 1080 window gives a 1280 x 720 JPEG picture; a smaller window keeps its own size', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent('<h1 dir="rtl">طلبات التسجيل</h1>');
  const shot = await webShot(page);
  expect(shot.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect(size(shot)).toEqual({ width: 1280, height: 720 });
  await page.setViewportSize({ width: 1000, height: 600 });
  expect(size(await webShot(page))).toEqual({ width: 1000, height: 600 });
  await browser.close();
});
