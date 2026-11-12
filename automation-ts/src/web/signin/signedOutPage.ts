import { Page } from '@playwright/test';
import { pathOf } from './signInPage';
import { onPage, SHELL, STATE } from './signInScripts';

/** what the page shows: a password box, a sign-in address, its path, a code box, the signed-in menu */
export type PageSigns = { pw?: boolean; login?: boolean; path?: string; mid?: boolean; shell?: boolean };

/** the app's own refused / expired pages (a whole part of the address, never a word inside one) */
const REFUSED = /(^|[/#])(unauthori[sz]ed|forbidden|access-?denied|session-?expired|401|403)([/?#]|$)/i;

/**
 * After a failed step: is the page really the app's sign-in page or its refused page? (Test 8094 run 631: a form's
 * "shift code" box read as "the app asks for its code" while the app stayed signed in.) A code box or a password box on
 * an app page is a form field, never a sign-out; a password box counts only without the signed-in menu. A page that
 * could not be read is not a sign-out - the step fails with its own reason.
 */
export function signInPageShows(s: PageSigns | undefined, start: string | undefined): boolean {
  if (!s) return false;
  const path = s.path ?? '';
  if (s.login || REFUSED.test(path)) return true;
  const startPath = pathOf(start);
  if (startPath && !/^\/?#?\/?$/.test(startPath) && startPath === path) return true;
  return !!s.pw && !s.shell;
}

/** the page now: on the app's sign-in or refused page (start = the login's own sign-in address) */
export async function onSignInPage(page: Page, start: string | undefined): Promise<boolean> {
  const s = await onPage<PageSigns>(page, STATE);
  if (!s) return false;
  return signInPageShows({ ...s, shell: !!(await onPage<string | null>(page, SHELL)) }, start);
}
