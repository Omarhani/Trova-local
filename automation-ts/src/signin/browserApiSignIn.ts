import { asObject, byName, JsonObject, section } from '../run/runDataFile';
import { SignInResult } from '../trova/recipeSignIn';
import { BrowserLook, endedWords, usingLine } from './browserSignIn';
import { browserSignIns } from './browserSignInFile';
import { tokenOf } from './browserToken';

/** what the API side stands on: the saved sign-in, the login's sign-in recipe (none = undefined), the run line */
export interface BrowserApiDeps {
  look: (login: string) => BrowserLook;
  recipe: (login: string) => JsonObject | undefined;
  say: (line: string) => void;
}

const DEPS: BrowserApiDeps = {
  look: (login) => browserSignIns.look(login),
  recipe: (login) => {
    try {
      return asObject(byName(section('signInApi'), login));
    } catch {
      return undefined; // no run file: the token is found in the values
    }
  },
  say: (line) => console.log(line),
};

/**
 * The run's API sign-in taken from the sign-in the tester saved in a real browser (Omar 2026-11-10) - its token by the
 * recipe's token key, its whole state as the kept values; no sign-in call. undefined = none saved (the API sign-in as
 * before). Throws the plain reason when it ended, or when the app dropped it (again): never a new sign-in.
 */
export function apiFromBrowser(login: string, again: boolean, d: BrowserApiDeps = DEPS): SignInResult | undefined {
  const look = d.look(login);
  if (look.kind === 'none') return undefined;
  if (look.kind === 'ended') throw new Error(look.why);
  if (again) throw new Error(endedWords(login));
  d.say(usingLine(login, look.signIn));
  return { token: tokenOf(look.signIn.browser, d.recipe(login)), browser: look.signIn.browser };
}
