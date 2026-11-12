import { Page } from '@playwright/test';
import { BrowserState } from '../browserState';
import { answerIn, waitAtMost } from './answerIn';
import { standInAddress } from './standIn';

/** how long the browser may take to open the app's address and to take the sign-in (each step) */
export interface PutLimits {
  openMs: number;
  answerMs: number;
}

const LIMITS: PutLimits = { openMs: 30_000, answerMs: 10_000 };

/** an empty browser state: the app shows its sign-in page */
export function emptyState(): BrowserState {
  return { localStorage: {}, sessionStorage: {}, cookies: {} };
}

/**
 * The login's whole browser state put into the run's browser: cookies, then local and session storage on the app's
 * origin - each step within a bounded time (Test 8094 runs 619-621: after the app's sign-in page with Google's "I'm not
 * a robot" frame, the browser never answered the removal of the blank-page stand-in and the page set-up hung 5 min).
 */
export async function putState(page: Page, state: BrowserState, origin: string, limits: PutLimits = LIMITS): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  const host = new URL(origin).hostname;
  const cookies = Object.entries(state.cookies).map(([name, value]) => ({
    name, value, domain: host, path: '/', expires: -1, httpOnly: false, secure: origin.startsWith('https'), sameSite: 'Lax' as const }));
  if (cookies.length) await context.addCookies(cookies);
  // an empty page on the app's origin - the app's own scripts never run before its sign-in is in place
  const standIn = standInAddress(origin);
  await page.route(standIn, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  await answerIn(page.goto(standIn, { waitUntil: 'domcontentloaded', timeout: limits.openMs }), limits.openMs + 1000,
    `The browser did not open the app's address within ${limits.openMs / 1000} s to put the sign-in in`);
  await answerIn(page.evaluate(({ local, session }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const [k, v] of Object.entries(local)) window.localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(session)) window.sessionStorage.setItem(k, v);
  }, { local: state.localStorage, session: state.sessionStorage }), limits.answerMs,
  `The browser did not take the sign-in within ${limits.answerMs / 1000} s`);
  // the stand-in serves an address the app never uses: a browser that does not answer its removal is not waited for
  await waitAtMost(page.unroute(standIn), limits.answerMs);
}

/** what the app keeps in the browser now on its origin: local and session storage, cookies (values never printed) */
export async function readState(page: Page): Promise<BrowserState> {
  const stores = await page.evaluate(() => ({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }))
    .catch(() => ({ local: {}, session: {} }));
  const cookies: Record<string, string> = {};
  for (const c of await page.context().cookies(page.url()).catch(() => [])) cookies[c.name] = c.value;
  return { localStorage: stores.local as Record<string, string>, sessionStorage: stores.session as Record<string, string>, cookies };
}
