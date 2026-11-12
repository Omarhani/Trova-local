import { asObject, asText, byName, section } from '../run/runDataFile';
import { SignInResult } from '../trova/recipeSignIn';

/**
 * The ONE sign-in Trova made for this login and environment, shared with everything running at the same time (an AI
 * run, a writer's try, a suite run) - "signInShared" / "signInSharedPhone" in the run file. Using it means no new
 * one-time code is asked of the app. undefined = Trova made none; throws when Trova's own sign-in was refused.
 */
export function sharedSignIn(login: string, phone: boolean): SignInResult | undefined {
  const one = asObject(byName(section(phone ? 'signInSharedPhone' : 'signInShared'), login));
  if (one.why !== undefined && one.browser === undefined) throw new Error(`The app refused the sign-in: ${asText(one.why)}`);
  if (one.browser === undefined) return undefined;
  const browser: SignInResult['browser'] = { localStorage: {}, sessionStorage: {}, cookies: {} };
  for (const place of ['localStorage', 'sessionStorage', 'cookies'] as const) {
    for (const [k, v] of Object.entries(asObject(asObject(one.browser)[place]))) browser[place][k] = asText(v);
  }
  return { token: asText(one.token), browser };
}
