import { asObject, asText, byName, Json, runData, section } from '../run/runDataFile';
import { SignInResult } from '../trova/recipeSignIn';
import { recipeFor } from '../signin/signIns';
import { withFreshToken } from './freshToken';

/** What the browser gets before the app's first page: names to values per place. */
export interface BrowserState {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Record<string, string>;
}

type Kept = { localStorage?: Json; sessionStorage?: Json; cookies?: Json } | undefined;

/**
 * The browser state of a signed-in run, built the way the Java helpers build it (SignedInBrowser.put, Test 8094 run 574):
 * the kept full state Trova has for the login, the API sign-in's keys over it, the sign-in page's settings (language,
 * theme ...) only where missing, then Test Data -> Browser storage on top. Values are never printed.
 */
export function composeState(api: SignInResult, kept: Kept, recipeBrowser: Json[], storage: Json[]): BrowserState {
  const state: BrowserState = {
    localStorage: texts(kept?.localStorage),
    sessionStorage: texts(kept?.sessionStorage),
    cookies: cookieTexts(kept?.cookies),
  };
  Object.assign(state.localStorage, api.browser.localStorage);
  Object.assign(state.sessionStorage, api.browser.sessionStorage);
  Object.assign(state.cookies, api.browser.cookies);
  Object.assign(state, withFreshToken(state, api.token)); // run 679: the kept user's token is the new one too
  for (const e of recipeBrowser.map(asObject)) {
    if (e.ifMissing !== true || !e.key) continue;
    const place = placeOf(asText(e.place) || 'localStorage');
    if (state[place][asText(e.key)] === undefined) state[place][asText(e.key)] = asText(e.value);
  }
  for (const item of storage.map(asObject)) {
    const type = asText(item.type).toUpperCase();
    const place = type === 'COOKIE' ? 'cookies' : type === 'SESSION' ? 'sessionStorage' : 'localStorage';
    state[place][asText(item.name)] = asText(item.value);
  }
  return state;
}

/** the state for login from the run file: Trova's kept sign-in, the login's recipe settings, Test Data storage */
/**
 * The tries the Java helpers make (SignedInBrowser.put, Test 8094 run 599): the kept full state with the API keys over
 * it, then - when the app still does not open signed in - the API keys alone (a kept state can hold another tenant's
 * or an old session's values). One try when nothing is kept.
 */
export function composeStates(api: SignInResult, kept: Kept, recipeBrowser: Json[], storage: Json[]): BrowserState[] {
  const keptAny = kept && [kept.localStorage, kept.sessionStorage, kept.cookies].some((v) => v && Object.keys(asObject(v as Json)).length);
  const first = composeState(api, kept, recipeBrowser, storage);
  return keptAny ? [first, composeState(api, undefined, recipeBrowser, storage)] : [first];
}

/** the tries for a login: its kept state, recipe page settings (+ ones read now) and Test Data storage with its API sign-in */
export function statesFor(login: string, api: SignInResult, pageSettings: Json[] = []): BrowserState[] {
  const kept = asObject(asObject(byName(section('signIn'), login)).session) as Kept;
  let recipeBrowser: Json[] = [];
  try {
    const b = recipeFor(login, 'web').browser;
    recipeBrowser = Array.isArray(b) ? b : [];
  } catch {
    recipeBrowser = [];
  }
  const storage = runData().storage;
  return composeStates(api, kept, [...recipeBrowser, ...pageSettings], Array.isArray(storage) ? storage : []);
}

function placeOf(place: string): keyof BrowserState {
  return place === 'sessionStorage' ? 'sessionStorage' : place === 'cookies' ? 'cookies' : 'localStorage';
}

function texts(v: Json | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(asObject(v))) out[k] = asText(x);
  return out;
}

function cookieTexts(v: Json | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of Array.isArray(v) ? v : []) {
    const o = asObject(c);
    if (o.name) out[asText(o.name)] = asText(o.value);
  }
  return out;
}
