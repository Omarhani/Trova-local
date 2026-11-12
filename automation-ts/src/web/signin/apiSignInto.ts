import { Page } from '@playwright/test';
import { recipeFor, signIn } from '../../signin/signIns';
import { sharedSignIn } from '../../signin/sharedSignIn';
import { BrowserState, statesFor } from '../browserState';
import { proveSignedIn } from './appProof';
import { putState } from './browserPut';
import { keepState, keptState } from './keptSignIn';
import { pageSettingsFor } from './pageSettingsOnce';

/**
 * Hybrid: the run's ONE API sign-in (made from scratch by the app's own calls, no screen - or the one an earlier block
 * of the run made, with no call) put into the browser and proved: its keys over the state Trova kept, then its keys
 * alone (Java SignedInBrowser.put). A login with no API sign-in at all opens with the state Trova kept, never the
 * screen. fresh = a new sign-in (the run's one ran out). null = proved, else why not.
 */
export async function apiSignInto(page: Page, web: string, login: string, fresh: boolean): Promise<string | null> {
  const origin = new URL(web).origin;
  if (!fresh && !hasApiSignIn(login)) {
    const kept = keptState(login);
    if (!kept) recipeFor(login, 'web'); // throws the plain "no sign-in recipe" reason
    return tryStates(page, web, login, [kept!.state], origin);
  }
  const api = await signIn(login, 'web', fresh);
  const settings = fresh ? [] : await pageSettingsFor(page, web, login);
  return tryStates(page, web, login, statesFor(login, api, settings), origin);
}

async function tryStates(page: Page, web: string, login: string, states: BrowserState[], origin: string): Promise<string | null> {
  let why: string | null = 'nothing could be put into the browser';
  for (const state of states) {
    await putState(page, state, origin);
    why = await proveSignedIn(page, web);
    if (!why) {
      keepState(login, state, web);
      return null;
    }
  }
  return why;
}

/** the login has an API sign-in: its recipe, or the one Trova shares */
function hasApiSignIn(login: string): boolean {
  try {
    recipeFor(login, 'web');
    return true;
  } catch {
    try { return sharedSignIn(login, false) !== undefined; } catch { return true; } // a refused shared one: signIn says why
  }
}
