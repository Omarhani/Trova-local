import { Browser, Page } from '@playwright/test';
import { trovaTest } from '../run/trovaTest';
import { keepTestEnd } from './lastScreen';
import { joinSharedBrowser, viewport } from './sharedBrowser';
import { picturesAfterChecks, stepPictures } from './stepPictures';

/**
 * The web test base for the sign-in page's own cases (Java LoginTests): a page in a fresh, signed-out window of the run's
 * browser - nothing of the run's one sign-in in it, and the run's signed-in tab untouched. Its step pictures and its last
 * screen go with the result as on every web test; the window is closed after the case.
 */
export const signedOutWebTest = trovaTest.extend<{ page: Page }, { browser: Browser }>({
  browser: [async ({}, use) => {
    const { browser, own } = await joinSharedBrowser();
    await use(browser);
    if (own) await browser.close();
  }, { scope: 'worker' }],
  page: async ({ browser }, use, testInfo) => {
    const window = await browser.newContext({ viewport: viewport() });
    const page = await window.newPage();
    const stopPictures = picturesAfterChecks(page);
    try {
      await use(page);
      stopPictures();
      await stepPictures.done(page);
      await keepTestEnd(page, (name, a) => testInfo.attach(name, a), testInfo.status !== testInfo.expectedStatus);
    } finally {
      stopPictures();
      await window.close().catch(() => undefined);
    }
  },
});
