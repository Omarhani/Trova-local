import { ElementHandle, Page } from '@playwright/test';
import { settle } from '../covers';
import { findNow } from './signInPage';

const TRIES = 4;
const REDRAWN = /not attached|detached/i;
const COVERED = /intercepts pointer events/i;

type Done = (el: ElementHandle, last: boolean, covered: boolean) => Promise<void>;

/**
 * One sign-in step's element, found again right before it acts - the TS twin of utils.SignInAct (Omar 2026-10-25, online
 * run #14: the sign-in form redraws after the account code). A redrawn, covered or not-ready element is found again a
 * few times; the last try of a covered button presses it by script. Never logs a value.
 */
export async function clickStep(page: Page, selector: string, first: ElementHandle | null): Promise<void> {
  await withRetries(page, selector, first, async (el, last, covered) => {
    if (last && covered) {
      await el.evaluate((e) => (e as HTMLElement).click()); // covered every time: pressed by script
      await settle(page, 2000);
    } else {
      await el.click({ timeout: 5000 });
    }
  });
}

/** empties the box (both ends) and types the value */
export async function typeStep(page: Page, selector: string, first: ElementHandle | null, value: string): Promise<void> {
  await withRetries(page, selector, first, async (el) => {
    await el.fill('', { timeout: 5000 });
    await el.fill(value, { timeout: 5000 });
  });
}

async function withRetries(page: Page, selector: string, first: ElementHandle | null, act: Done): Promise<void> {
  let el = first;
  let last: Error | undefined;
  for (let i = 0; i < TRIES; i++) {
    el ??= await findNow(page, selector, 3000);
    if (!el) break;
    try {
      await act(el, i === TRIES - 1, !!last && COVERED.test(last.message));
      return;
    } catch (e) {
      last = e as Error;
      await gone(page, el);
      el = null;
    }
  }
  throw new Error(`the sign-in page's ${plain(selector)} could not be used - ${why(last)}`);
}

/** waits (up to 2 s) until the old element has left the page, so the next find gets the new one */
async function gone(page: Page, old: ElementHandle): Promise<void> {
  for (const until = Date.now() + 2000; Date.now() < until; await page.waitForTimeout(100)) {
    if (!(await old.evaluate((e) => e.isConnected).catch(() => false))) break;
  }
  await settle(page, 1500);
}

function why(last: Error | undefined): string {
  if (!last) return 'it was not there';
  if (COVERED.test(last.message)) return 'something kept covering it';
  return REDRAWN.test(last.message) ? 'the page kept redrawing it' : 'it never got ready';
}

/** text=Send -> "Send" button; a css selector -> box or button */
export function plain(selector: string): string {
  const s = (selector ?? '').split(',')[0].trim();
  return s.startsWith('text=') ? `"${s.slice(5).replace(/^['"]|['"]$/g, '')}" button` : 'box or button';
}
