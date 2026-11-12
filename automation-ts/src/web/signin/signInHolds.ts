import { Page, Request } from '@playwright/test';
import { wantedCall } from '../../report/networkEvents';
import { refusedPage } from '../pageFacts';
import { onPage, STATE } from './signInScripts';

/** how long a freshly put sign-in is watched: at least MIN, done once the app's calls are QUIET, never past MAX */
export const HOLD = { minMs: 1500, quietMs: 700, maxMs: 5000, lookMs: 150 };

type State = { pw?: boolean; login?: boolean };

const CALL = new Set(['fetch', 'xhr']);

/** the app's own call - a map or monitoring call (Google, LogRocket ...) never signs anyone out (Test 8094 run 616) */
export function appCall(r: Request): boolean {
  return CALL.has(r.resourceType()) && wantedCall(r.resourceType(), r.url(), r.method());
}

/** a newly put sign-in watched from the moment the app is opened; holds() = it held (watching stops then) */
export interface HoldWatch {
  holds: () => Promise<boolean>;
  stop: () => void;
}

/**
 * A sign-in just put into the browser holds: the app's first calls have answered and it did not go to its sign-in
 * page or a no-right page (Test 8094 run 609: the menu showed, the first call was refused, the app went to its sign-in
 * page 2.5 s later and the test's first click landed there). Watched from the moment the app is opened, so its calls
 * while it loads count and the time it took to load counts toward the least watch (run 615: 1.5 s more after it had
 * settled). Only after a new state is put in - a held sign-in pays nothing.
 */
export function watchHold(page: Page, hold = HOLD): HoldWatch {
  const busy = new Set<Request>();
  const calls = { busy, last: Date.now() };
  const start = (r: Request): void => { if (appCall(r)) { busy.add(r); calls.last = Date.now(); } };
  const end = (r: Request): void => { if (busy.delete(r)) calls.last = Date.now(); };
  page.on('request', start);
  page.on('requestfinished', end);
  page.on('requestfailed', end);
  const began = Date.now();
  const stop = (): void => {
    page.off('request', start);
    page.off('requestfinished', end);
    page.off('requestfailed', end);
  };
  return { stop, holds: async () => {
    try {
      return await until(page, hold, began, calls);
    } finally {
      stop();
    }
  } };
}

/** began = the app was opened; at most maxMs from now; done at least minMs after began, once calls were quiet quietMs */
async function until(page: Page, hold: typeof HOLD, began: number, calls: { busy: Set<Request>; last: number }): Promise<boolean> {
  const looking = Date.now();
  for (;;) {
    if (await signedOutNow(page)) return false;
    const now = Date.now();
    if (now - looking >= hold.maxMs) return true;
    if (now - began >= hold.minMs && calls.busy.size === 0 && now - calls.last >= hold.quietMs) return !(await signedOutNow(page));
    await new Promise((r) => setTimeout(r, hold.lookMs));
  }
}

async function signedOutNow(page: Page): Promise<boolean> {
  if (refusedPage(page.url())) return true;
  const s = await onPage<State>(page, STATE);
  return !!s && (!!s.pw || !!s.login);
}
