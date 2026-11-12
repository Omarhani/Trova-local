import { Page } from '@playwright/test';
import { SavedSignIn } from '../../signin/savedSignIn';
import { putState } from './browserPut';

/**
 * The browser's whole sign-in now, by Playwright's own storageState (every cookie with its end time and flags, every
 * origin's local storage) plus the app's session storage, which storageState leaves out. Never printed.
 */
export async function captureSaved(page: Page, web: string): Promise<Omit<SavedSignIn, 'madeAt' | 'fresh'>> {
  const storage = await page.context().storageState();
  const sessionStorage = await page.evaluate(() => ({ ...window.sessionStorage }))
    .catch(() => ({})) as Record<string, string>;
  return { origin: new URL(web).origin, storage, sessionStorage };
}

/**
 * The saved sign-in put into the run's one tab (it is shared by the blocks through the run's one Chrome, so a new
 * context with storageState is not an option): local and session storage before the app's first page, then every
 * saved cookie as storageState keeps it. No sign-in call.
 */
export async function putSaved(page: Page, saved: SavedSignIn): Promise<void> {
  const local = saved.storage.origins.find((o) => o.origin === saved.origin)?.localStorage ?? [];
  await putState(page, { localStorage: Object.fromEntries(local.map((x) => [x.name, x.value])),
    sessionStorage: saved.sessionStorage, cookies: {} }, saved.origin);
  if (saved.storage.cookies.length) await page.context().addCookies(saved.storage.cookies);
}
