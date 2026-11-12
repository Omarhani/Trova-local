import { ElementHandle, Page } from '@playwright/test';
import { BUTTON, DONE, FIND, onPage, PICK, SAID, script, SHELL, STATE } from './signInScripts';

/**
 * Where a sign-in page stands, read the way the AI agent reads it - the TS twin of utils.SignInPage (Omar 2026-10-23):
 * signed in = off the sign-in page (no password box, no code box, off a login address) AND the login's done sign shows
 * (a part of the address, a selector, or its words), OR the page has the signed-in shell (side menu / user menu).
 */

type State = { pw?: boolean; login?: boolean; path?: string; mid?: boolean };

/** a done the AI gave that names nothing on the page: "true", "done", empty ... */
export function meaningless(done: string | undefined): boolean {
  return !done || /^\s*(true|false|yes|no|done|ok|1|0)?\s*$/i.test(done);
}

/** the kind of a login field by its name: password, otp, or other (an account code is not an OTP) */
export function family(field: string | undefined): 'password' | 'otp' | 'other' {
  const f = field ?? '';
  if (/(pass|pwd|كلمة)/is.test(f)) return 'password';
  if (/(account|company|client|org|tenant|حساب|منشأة|شركة)/is.test(f)) return 'other';
  if (/(otp|one.?time|code|verif|pin|sms|رمز|تحقق)/is.test(f)) return 'otp';
  return 'other';
}

/** null when the page is signed in now, else what is wrong in plain words; start = the recipe's own sign-in address */
export async function signedInNow(page: Page, done: string | undefined, start: string | undefined): Promise<string | null> {
  const s = await onPage<State>(page, STATE);
  if (!s) return 'the page could not be read';
  if (s.pw || s.login) return 'the app showed its sign-in page';
  if (s.mid) return 'the app still asks for its code';
  const startPath = pathOf(start);
  if (startPath && !/^\/?#?\/?$/.test(startPath) && startPath === s.path) return 'the app stayed on its sign-in page';
  if (await doneShows(page, done)) return null;
  if (await onPage<string | null>(page, SHELL)) return null;
  return meaningless(done) ? null : `the signed-in page did not show (${done})`;
}

/** mid-sign-in: a password box or a code box is on the page */
export async function midSignIn(page: Page): Promise<boolean> {
  const s = await onPage<State>(page, STATE);
  return !s || !!s.pw || !!s.mid;
}

/** a selector for the login field's box now on the page (found by its kind), or null */
export async function pickBox(page: Page, field: string): Promise<string | null> {
  return (await onPage<string | null>(page, PICK, family(field), field ?? '')) ?? null;
}

/** the open dialog's confirm button text (pressed when click), or null */
export async function dialogButton(page: Page, click: boolean): Promise<string | null> {
  return (await onPage<string | null>(page, BUTTON, click)) ?? null;
}

/** what the app says on the page (a toast, an error under a box), "" when nothing */
export async function pageSays(page: Page): Promise<string> {
  return (await onPage<string>(page, SAID)) ?? '';
}

/** the element the agent's finder gives now, waiting up to ms; null when it is not there */
export async function findNow(page: Page, selector: string, ms: number): Promise<ElementHandle | null> {
  for (const until = Date.now() + ms; ; await page.waitForTimeout(300)) {
    const h = await page.evaluateHandle(script(FIND, selector)).catch(() => undefined);
    const el = h?.asElement() ?? null;
    if (el) return el;
    await h?.dispose();
    if (Date.now() >= until) return null;
  }
}

async function doneShows(page: Page, done: string | undefined): Promise<boolean> {
  const d = (done ?? '').trim();
  if (meaningless(d)) return false;
  const t = /^text=(.+)$/s.exec(d);
  const h = /:has-text\((['"])(.*)\1\)$/s.exec(d);
  const words = (t ? t[1] : h ? h[2] : /[^\x00-\x7f]/.test(d) ? d : '').trim().replace(/^['"]|['"]$/g, '');
  return (await onPage<boolean>(page, DONE, d, words)) === true;
}

/** the path and hash of an address, "" when it is not one */
export function pathOf(url: string | undefined): string {
  try {
    const u = new URL(url ?? '');
    return u.pathname + u.hash;
  } catch {
    return '';
  }
}
