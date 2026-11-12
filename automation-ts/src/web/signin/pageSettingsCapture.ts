import { Page } from '@playwright/test';
import { emptyState, putState } from './browserPut';

const SECRET_KEY = /(token|jwt|auth|session|secret|password|pass|otp|user|account|refresh)/i;
const SECRET_VALUE = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$|^[A-Za-z0-9+/=_-]{40,}$/;
const THIRD_PARTY = /^(__mpq|mp_|_ga|_gid|_gcl|_grecaptcha|amplitude|ajs_|_hj|intercom|lr-|_lr|_fbp|__stripe|optimizely|_dd)/i;

/** place -> key -> value: the settings the sign-in page writes first (theme, language ...) */
export type PageSettings = Partial<Record<'localStorage' | 'sessionStorage', Record<string, string>>>;

/** a page setting: short, not a sign-in value, not a third party's key */
export function isPageSetting(key: string, value: string | null | undefined): boolean {
  return !!key?.trim() && value !== null && value !== undefined && value.length <= 200 && !SECRET_KEY.test(key)
    && !THIRD_PARTY.test(key) && !SECRET_VALUE.test(value);
}

/**
 * The page settings the app's sign-in page writes, read ONCE - the TS twin of utils.PageSettingsCapture (Omar
 * 2026-10-27, session 270: a sign-in learned before Trova kept page settings opened the app unstyled): the app opened
 * signed out with nothing in the browser, what it writes is read, and the browser is cleaned again. No fixed wait: the
 * page is read as soon as it is loaded, and again for at most 2 s while it has written nothing yet.
 */
export async function readPageSettings(page: Page, url: string): Promise<PageSettings> {
  const origin = new URL(url).origin;
  await putState(page, emptyState(), origin);
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  let out: PageSettings = {};
  for (const until = Date.now() + 2000; ; await page.waitForTimeout(250)) {
    out = await settingsNow(page);
    if (Object.keys(out).length || Date.now() >= until) break;
  }
  await putState(page, emptyState(), origin);
  return out;
}

async function settingsNow(page: Page): Promise<PageSettings> {
  const all = await page.evaluate(() => ({ localStorage: { ...window.localStorage }, sessionStorage: { ...window.sessionStorage } }))
    .catch(() => ({ localStorage: {}, sessionStorage: {} }));
  const out: PageSettings = {};
  for (const place of ['localStorage', 'sessionStorage'] as const) {
    const keep = Object.fromEntries(Object.entries(all[place] as Record<string, string>).filter(([k, v]) => isPageSetting(k, v)));
    if (Object.keys(keep).length) out[place] = keep;
  }
  return out;
}
