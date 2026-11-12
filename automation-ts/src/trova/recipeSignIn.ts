import { HttpSend, json } from './http';
import { asObject, asText, Json, JsonObject } from './json';
import { at, fill, loginField, plain, present } from './recipeValues';

/** What one API sign-in gives: the token and the browser keys {localStorage, sessionStorage, cookies}. */
export interface SignInResult {
  token: string;
  browser: Record<'localStorage' | 'sessionStorage' | 'cookies', Record<string, string>>;
}

/**
 * "Log in programmatically" by API for any app: the login's recipe (the app's own sign-in calls, learned by Trova)
 * with the login's fields - the TS twin of utils.ApiSignIn.runOn. Never prints a value.
 */
export async function runRecipe(recipe: JsonObject, fields: Record<string, string>, base: string, http: HttpSend,
                                headers: () => Record<string, string>): Promise<SignInResult> {
  const field = (names: string): string => {
    const v = loginField(fields, names);
    if (v === undefined) throw new Error(`The login has no ${names.split('|')[0]} - add it in Test Data > Credentials`);
    return v;
  };
  const transforms = asObject(recipe.transforms);
  const kept: JsonObject = {};
  for (const c of Array.isArray(recipe.calls) ? recipe.calls : []) {
    const call = asObject(c);
    const answer = await oneCall(recipe, call, { field, kept, transforms, base, http, headers });
    for (const [name, where] of Object.entries(asObject(call.keep))) {
      const v = at(answer, asText(where));
      if (v !== undefined) kept[name] = v;
    }
    if (call.doneWhen && present(kept[asText(call.doneWhen)])) break;
  }
  const token = plain(kept[asText(recipe.token)]);
  return { token, browser: browserKeys(recipe, field, kept, transforms) };
}

interface CallContext {
  field: (names: string) => string;
  kept: JsonObject;
  transforms: JsonObject;
  base: string;
  http: HttpSend;
  headers: () => Record<string, string>;
}

async function oneCall(recipe: JsonObject, call: JsonObject, ctx: CallContext): Promise<Json> {
  const path = asText(call.path);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', ...ctx.headers() };
  for (const [k, v] of Object.entries(asObject(fill(call.headers, ctx.field, ctx.kept, ctx.transforms)))) headers[k] = plain(v);
  const body = call.body === undefined ? undefined : JSON.stringify(fill(call.body, ctx.field, ctx.kept, ctx.transforms));
  const answer = await ctx.http({ method: (asText(call.method) || 'POST').toUpperCase(), url: recipeUrl(recipe, path, ctx.base), headers, body });
  if (answer.status >= 400) throw new Error(`The app refused the sign-in: ${path} answered HTTP ${answer.status}`);
  const parsed = json(answer) as Json;
  refused(call, parsed, path);
  return parsed;
}

/** "refusedWhen": the app said no in its own answer (HTTP 200 with Status false ...) - its own words */
function refused(call: JsonObject, answer: Json, path: string): void {
  const when = asObject(call.refusedWhen);
  if (!when.field) return;
  const v = at(answer, asText(when.field));
  if (v === undefined || JSON.stringify(v) !== JSON.stringify(when.is)) return;
  const said = when.say ? plain(at(answer, asText(when.say))) : '';
  throw new Error(`The app refused the call ${path}: ${said}`);
}

function browserKeys(recipe: JsonObject, field: (n: string) => string, kept: JsonObject, transforms: JsonObject): SignInResult['browser'] {
  const out: SignInResult['browser'] = { localStorage: {}, sessionStorage: {}, cookies: {} };
  for (const b of Array.isArray(recipe.browser) ? recipe.browser : []) {
    const o = asObject(b);
    if (o.ifMissing === true) continue; // page settings go in only when missing - the page keeps its own
    const v = o.from !== undefined ? kept[asText(o.from)] : fill(o.value, field, kept, transforms);
    if (v === undefined || v === null) continue;
    const place = asText(o.place) as keyof SignInResult['browser'];
    (out[place] ??= {})[asText(o.key)] = asText(o.as) === 'json' ? JSON.stringify(v) : plain(v);
  }
  return out;
}

/** the API address + the call's path ("apiRoot" added only when the address does not end with it already) */
export function recipeUrl(recipe: JsonObject, path: string, apiBase: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase.replace(/\/+$/, '');
  if (!base) throw new Error('No API address for this environment - add it in Test Data > Environments');
  const root = asText(recipe.apiRoot).replace(/^\/+|\/+$/g, '');
  const p = path.replace(/^\/+/, '');
  const add = root !== '' && !base.toLowerCase().endsWith(`/${root.toLowerCase()}`) && !p.toLowerCase().startsWith(`${root.toLowerCase()}/`);
  return `${base}/${add ? `${root}/` : ''}${p}`;
}
