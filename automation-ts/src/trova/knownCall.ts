import { accountClock } from '../data/appClock';
import { Json, JsonObject } from './json';

/**
 * The body Trova KNOWS for an app endpoint (the last passed AI walk's call, else the Endpoints catalog's) - handed to
 * the run in the run file's "knownCalls"; the TS twin of utils.KnownCall. Never a hand-made body.
 */
export interface KnownCall {
  side: string;
  method: string;
  path: string;
  body: string;
}

type Values = Record<string, unknown>;

/** "POST /x" -> ["POST", "/x"]; "/x" -> ["", "/x"] */
export function splitEndpoint(endpoint: string): [string, string] {
  const e = endpoint.trim();
  const m = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i.exec(e);
  return m ? [m[1].toUpperCase(), m[2].trim()] : ['', e];
}

export function findKnown(list: KnownCall[], side: string, method: string, path: string): KnownCall | undefined {
  const want = plainPath(path);
  let any: KnownCall | undefined;
  for (const k of list) {
    if (k.side.toUpperCase() !== (side || 'WEB').toUpperCase() || !samePath(plainPath(k.path), want)) continue;
    if (!method) {
      if (k.method !== 'GET') return k;
      any ??= k;
    } else if (k.method === method.toUpperCase()) return k;
  }
  return any;
}

/** a path without scheme / host / query, lower case, no trailing slash */
export function plainPath(path: string): string {
  let p = path.trim().toLowerCase().split('?')[0];
  const scheme = p.indexOf('://');
  if (scheme >= 0) {
    const slash = p.indexOf('/', scheme + 3);
    p = slash < 0 ? '/' : p.slice(slash);
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

/** same path; a {name} part matches any part */
export function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  const x = a.split('/');
  const y = b.split('/');
  return x.length === y.length && x.every((part, i) => part === y[i] || part.startsWith('{') || y[i].startsWith('{'));
}

/** the known body filled: given values by field name, then placeholders, then the sign-in's own ids; undefined = no body */
export function fillKnownBody(known: KnownCall | undefined, signIn: Record<string, string>, given: Values): string | undefined {
  if (!known || !known.body.trim()) return Object.keys(given).length ? JSON.stringify(given) : undefined;
  const filled = fillValue(JSON.parse(known.body) as Json, signIn, given);
  if (filled !== null && typeof filled === 'object' && !Array.isArray(filled)) {
    for (const [k, v] of Object.entries(given)) {
      if (!has(filled, norm(k)) && !known.path.includes(`{${k}}`)) filled[k] = v as Json;
    }
  }
  return JSON.stringify(filled);
}

function fillValue(e: Json, signIn: Record<string, string>, given: Values): Json {
  if (Array.isArray(e)) return e.map((x) => fillValue(x, signIn, given));
  if (e === null || typeof e !== 'object') return placeholder(e, signIn, given);
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(e)) {
    const value = byName(given, k);
    const own = byName(signIn, k);
    if (value !== undefined) out[k] = value as Json;
    else if (v !== null && typeof v !== 'object' && placeholderName(v) === undefined && typeof own === 'string') out[k] = typed(own, v);
    else out[k] = fillValue(v, signIn, given);
  }
  return out;
}

function placeholder(v: Json, signIn: Record<string, string>, given: Values): Json {
  const name = placeholderName(v);
  if (name === undefined) return v;
  const value = byName(given, name) ?? byName(signIn, name) ?? time(name);
  if (value === undefined) throw new Error(`The known body needs "${name}" - give it by field name in the call's values`);
  return value as Json;
}

function placeholderName(v: Json): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (/^\{\{[^{}]+}}$/.test(t)) return t.slice(2, -2).trim();
  if (/^\{[A-Za-z_][\w.:-]*}$/.test(t)) return t.slice(1, -1);
  return undefined;
}

function time(name: string): string | undefined {
  // the app's own clock (its account's), never the computer's - run 1025: at 23:30 here the app was already on the next day
  const at = (plusMs: number): string => new Date(Date.now() + plusMs + accountClock.offsetMin() * 60_000).toISOString();
  switch (norm(name)) {
    case 'today': case 'date': return at(0).slice(0, 10);
    case 'tomorrow': return at(86_400_000).slice(0, 10);
    case 'now': case 'datetime': return at(0).slice(0, 19);
    default: return undefined;
  }
}

function byName(values: Values, field: string): unknown {
  const want = norm(field);
  const key = Object.keys(values).find((k) => norm(k) === want && values[k] !== undefined && values[k] !== null);
  return key === undefined ? undefined : values[key];
}

function has(e: Json, want: string): boolean {
  if (Array.isArray(e)) return e.some((x) => has(x, want));
  if (e === null || typeof e !== 'object') return false;
  return Object.entries(e).some(([k, v]) => norm(k) === want || has(v, want));
}

function typed(value: string, was: Json): Json {
  return typeof was === 'number' && /^-?\d+$/.test(value) ? Number(value) : value;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
