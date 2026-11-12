import { BrowserContext } from '@playwright/test';
import { endOf } from '../web/signin/signInClock';

/** Playwright's own saved browser state: every cookie with its end time, every origin's local storage */
export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * The run's one sign-in of a login, saved after it opened the app: Playwright's storageState plus the app's session
 * storage (storageState has none - memory note: ALL cookies + local + session storage). Never printed.
 */
export interface SavedSignIn {
  origin: string;
  storage: StorageState;
  sessionStorage: Record<string, string>;
  /** when it was made (epoch ms) */
  madeAt: number;
  /** fresh sign-ins after the first one (it ran out, or the app signed out in the middle of a case) */
  fresh: number;
  /** made from the sign-in the tester saved in a real browser: it ends then (epoch ms, 0 = not known), never renewed */
  browser?: { endsAt: number };
}

const FIVE_MIN = 5 * 60_000;
const JUST_MADE = 60_000;

/**
 * "in 4 min" when the saved sign-in runs out within min(5 min, a fifth of its life) - time for ONE fresh sign-in -
 * else null. One made under a minute ago is never due (a short-lived sign-in never loops).
 */
export function renewDue(saved: SavedSignIn, now = Date.now()): string | null {
  if (now - saved.madeAt < JUST_MADE) return null;
  const local = saved.storage.origins.find((o) => o.origin === saved.origin)?.localStorage ?? [];
  const end = endOf({
    localStorage: Object.fromEntries(local.map((x) => [x.name, x.value])),
    sessionStorage: saved.sessionStorage,
    cookies: saved.storage.cookies.map((c) => ({ name: c.name, value: c.value, expires: c.expires })),
  }, now);
  if (end.at <= 0) return null;
  return now >= end.at - Math.min(FIVE_MIN, Math.max(0, end.life) / 5) ? end.words(now) : null;
}
