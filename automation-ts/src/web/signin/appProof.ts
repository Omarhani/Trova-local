import { Page, Request, Response } from '@playwright/test';
import { retryOnce } from '../browserSlow';
import { settle } from '../covers';
import { stop } from '../pageOpen';
import { refusedPage } from '../pageFacts';
import { appCall, HOLD, watchHold } from './signInHolds';

/** what the app showed after it was opened: its address, whether the sign-in held, its own calls' statuses in order */
export interface ProofSeen {
  url: string;
  held: boolean;
  statuses: number[];
}

/**
 * Proved signed in: none of the app's own calls answered 401 / 403, it is not on its sign-in page, and its first call
 * answered 2xx. null = proved, else why not, in plain words.
 */
export function proofVerdict(seen: ProofSeen): string | null {
  const no = seen.statuses.find((s) => s === 401 || s === 403);
  if (no) return `its calls answered ${no}`;
  if (!seen.held || refusedPage(seen.url)) return 'it went to its sign-in page';
  if (!seen.statuses.length) return 'it made no call of its own, so Trova could not see it signed in';
  const first = seen.statuses[0];
  if (first === 0) return 'its first call got no answer';
  return first >= 200 && first < 300 ? null : `its first call answered ${first}`;
}

/** the app's own calls (never a map or monitoring call), their statuses in the order they answered */
function watchStatuses(page: Page): { statuses: number[]; first: (ms: number) => Promise<void>; stop: () => void } {
  const statuses: number[] = [];
  let answered: () => void = () => undefined;
  const one = new Promise<void>((r) => { answered = r; });
  const done = (status: number): void => { statuses.push(status); answered(); };
  const ok = (a: Response): void => { if (appCall(a.request())) done(a.status()); };
  const failed = (r: Request): void => { if (appCall(r)) done(0); };
  page.on('response', ok);
  page.on('requestfailed', failed);
  return {
    statuses,
    first: (ms) => Promise.race([one, new Promise<void>((r) => setTimeout(r, ms))]),
    stop: () => { page.off('response', ok); page.off('requestfailed', failed); },
  };
}

/**
 * Every case proves it is signed in before any step counts (Omar 2026-11-10, Test 8094 run 624): the app's address
 * opened with what the browser holds, watched from that moment (signInHolds) - the app's own first call must answer
 * 2xx, none may answer 401 / 403, and the page must not be its sign-in page. null = proved, else why not.
 */
export async function proveSignedIn(page: Page, web: string, limits: { firstMs?: number; openMs?: number } = {}): Promise<string | null> {
  const calls = watchStatuses(page);
  const hold = watchHold(page, HOLD);
  try {
    // run 960 case 529: a hung load is stopped and opened once more, as Java's goHomeWeb (openWithOneRetry) does
    const openMs = limits.openMs ?? 30_000;
    await retryOnce(() => page.goto(web, { waitUntil: 'domcontentloaded', timeout: openMs }), console.log, () => stop(page));
    await settle(page, 15_000);
    const held = refusedPage(page.url()) ? false : await hold.holds();
    if (!calls.statuses.length) await calls.first(limits.firstMs ?? 10_000);
    return proofVerdict({ url: page.url(), held, statuses: [...calls.statuses] });
  } finally {
    hold.stop();
    calls.stop();
  }
}
