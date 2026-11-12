import * as fs from 'node:fs';
import * as path from 'node:path';
import { asObject, asText, byName, Json, JsonObject, projectRoot, section } from '../../run/runDataFile';
import { testData } from '../../run/testData';
import { BrowserState } from '../browserState';
import { PageSettings } from './pageSettingsCapture';
import { ClockState } from './signInClock';

/**
 * What Trova keeps about a login's sign-in (the run file's "signIn" and "signInRefresh") and what a run leaves for it -
 * the TS twin of utils.KeptSignIn: a new state, healed screen steps or the sign-in page's settings go to
 * <project>/target/trova-sessions, which the runner sends to Trova while the run goes on. Never prints a value.
 */

/** the login's saved screen sign-in steps ({url, steps, done}), or undefined */
export function screenRecipe(login: string): JsonObject | undefined {
  const r = asObject(asObject(byName(section('signIn'), login)).recipe);
  return Array.isArray(r.steps) && r.steps.length ? r : undefined;
}

/** the sign-in state Trova kept for the login (as the browser gets it, and as the clock reads it), or undefined */
export function keptState(login: string): { state: BrowserState; clock: ClockState } | undefined {
  const s = asObject(asObject(byName(section('signIn'), login)).session);
  if (!s.origin) return undefined;
  const texts = (v: Json | undefined): Record<string, string> => Object.fromEntries(Object.entries(asObject(v)).map(([k, x]) => [k, asText(x)]));
  const cookies = (Array.isArray(s.cookies) ? s.cookies : []).map(asObject).filter((c) => c.name)
    .map((c) => ({ name: asText(c.name), value: asText(c.value), expires: typeof c.expires === 'number' ? c.expires : undefined }));
  const state: BrowserState = { localStorage: texts(s.localStorage), sessionStorage: texts(s.sessionStorage),
    cookies: Object.fromEntries(cookies.map((c) => [c.name, c.value])) };
  const signIn = (Array.isArray(s.signIn) ? s.signIn : []).map(asObject).map((t) => ({ place: asText(t.place), key: asText(t.key) }));
  return { state, clock: { ...state, cookies, signIn } };
}

/** the state the run's browser holds for a login, in the shape Trova keeps it */
export function keptShape(state: BrowserState, url: string): JsonObject {
  const origin = new URL(url).origin;
  return { origin, at: url, localStorage: state.localStorage, sessionStorage: state.sessionStorage,
    cookies: Object.entries(state.cookies).map(([name, value]) => ({ name, value, path: '/' })) };
}

/** a sign-in that opened the app: the next runs start from it */
export function keepState(login: string, state: BrowserState, url: string): void {
  leave(login, 'state', keptShape(state, url), '');
}

/** screen steps with a box or button found again: the next runs use them */
export function keepRecipe(login: string, recipe: JsonObject): void {
  leave(login, 'recipe', recipe, '-steps');
}

/** the settings the sign-in page wrote (read once): the runner adds them to the login's recipe */
export function keepPageKeys(login: string, keys: PageSettings): void {
  leave(login, 'pageKeys', keys as JsonObject, '-page');
}

/** true when the login's API recipe was already read for page settings (it has some, or "pageKeysRead") */
export function pageSettingsKnown(recipe: JsonObject | undefined): boolean {
  if (!recipe) return true; // no recipe: nothing to add to
  const browser = Array.isArray(recipe.browser) ? recipe.browser : [];
  return recipe.pageKeysRead === true || browser.some((b) => asObject(b).ifMissing === true);
}

/** the page settings as the recipe's set-if-missing entries */
export function asIfMissing(keys: PageSettings): Json[] {
  return Object.entries(keys).flatMap(([place, kv]) => Object.entries(kv ?? {}).map(([key, value]) => ({ place, key, value, ifMissing: true })));
}

function leave(login: string, part: string, what: JsonObject, suffix: string): void {
  try {
    // Omar 2026-11-11: TS runs go side by side - each run's own place (TROVA_SESSIONS_DIR), else the project's shared one
    const dir = process.env.TROVA_SESSIONS_DIR?.trim() || path.join(projectRoot(), 'target', 'trova-sessions');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${`${testData.env()}-${login}`.replace(/[^A-Za-z0-9._-]/g, '_')}${suffix}.json`);
    // written whole, then moved in: the runner sends it at once while the run goes on
    fs.writeFileSync(`${out}.part`, JSON.stringify({ login, environment: testData.env(), [part]: what }), 'utf8');
    fs.renameSync(`${out}.part`, out);
  } catch (e) {
    console.log(`The new sign-in could not be kept for the next runs: ${e instanceof Error ? e.name : 'not written'}`);
  }
}
