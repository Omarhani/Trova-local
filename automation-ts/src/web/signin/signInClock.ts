/**
 * When a sign-in runs out, read from its own values - the TS twin of utils.SignInClock (TICKET-980): a token's "exp"
 * (only its middle part is decoded, never printed), a key / field named like expires, expiry, exp, a cookie's end time.
 * Sign-ins can live 3 h or 5 min (banking): Trova refreshes one that runs out within min(2 min, 20% of its life). The
 * keys that came with the sign-in count (every key when none is tagged); the shortest end wins. Knows no app.
 */

const JWT = /eyJ[A-Za-z0-9_-]{4,}\.(eyJ[A-Za-z0-9_-]{4,})\.[A-Za-z0-9_-]*/g;
const END_NAME = /(expir|valid_?until|(^|[^a-z])exp($|[^a-z]))/i;
const END_NAME_CAMEL = /[a-z]Exp($|[A-Z_])/;
const RELATIVE = /(expires_?in|max_?age)$/i;
const ANALYTICS = /^(__mpq|mp_|_ga|_gid|_gcl|_grecaptcha|amplitude|ajs_|_hj|intercom|lr-|_lr|_fbp|__stripe|optimizely|_dd)/i;
const TWO_MIN = 120_000;
const DAY = 86_400_000;

type Cookie = { name: string; value: string; expires?: number };

/** a browser state as the clock reads it; signIn = the keys that came with the sign-in */
export interface ClockState {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  cookies?: Record<string, string> | Cookie[];
  signIn?: { place: string; key: string }[];
}

/** at = epoch ms it runs out (0 = no end found); life = ms it lives in all */
export class SignInEnd {
  constructor(readonly at: number, readonly life: number) {}

  /** runs out within min(2 min, 20% of its life) from now, or already did */
  soon(now = Date.now()): boolean {
    return this.at > 0 && now >= this.at - Math.min(TWO_MIN, Math.max(0, this.life) / 5);
  }

  expired(now = Date.now()): boolean {
    return this.at > 0 && now >= this.at;
  }

  /** "in 4 min" / "2 min ago" */
  words(now = Date.now()): string {
    const min = Math.trunc((this.at - now) / 60_000);
    return min >= 0 ? `in ${min} min` : `${-min} min ago`;
  }
}

class Best {
  at = 0;
  from = 0;

  constructor(private readonly now: number) {}

  offer(end: number, start: number): void {
    // ends older than 30 days are leftovers of an earlier sign-in
    if (end <= this.now - 30 * DAY || end > this.now + 400 * DAY || (this.at > 0 && end >= this.at)) return;
    this.at = end;
    this.from = start > 0 && start < end ? start : 0;
  }

  end(): SignInEnd {
    return new SignInEnd(this.at, this.from > 0 ? this.at - this.from : Number.MAX_SAFE_INTEGER / 4);
  }
}

/** the shortest end time of a browser state */
export function endOf(state: ClockState | undefined, now = Date.now()): SignInEnd {
  const best = new Best(now);
  if (!state) return best.end();
  const tagged = new Set((state.signIn ?? []).map((t) => `${t.place}\n${t.key}`));
  const counts = (place: string, key: string): boolean => !ANALYTICS.test(key) && (tagged.size === 0 || tagged.has(`${place}\n${key}`));
  for (const place of ['localStorage', 'sessionStorage'] as const) {
    for (const [k, v] of Object.entries(state[place] ?? {})) if (counts(place, k)) value(best, k, v);
  }
  const cookies: Cookie[] = Array.isArray(state.cookies) ? state.cookies
    : Object.entries(state.cookies ?? {}).map(([name, v]) => ({ name, value: v }));
  for (const c of cookies) {
    if (!counts('cookies', c.name)) continue;
    value(best, c.name, c.value ?? '');
    if (typeof c.expires === 'number' && c.expires > 0) best.offer(c.expires * 1000, 0);
  }
  return best.end();
}

/** the end of one token; at = 0 when it is not a token with "exp" */
export function endOfToken(token: string | undefined, now = Date.now()): SignInEnd {
  const best = new Best(now);
  if (token) value(best, '', token);
  return best.end();
}

function value(best: Best, key: string, text: string): void {
  for (const m of text.matchAll(JWT)) jwt(best, m[1]);
  const v = text.trim();
  if (v.startsWith('{') || v.startsWith('[')) {
    try {
      walk(best, JSON.parse(v) as unknown, 0);
    } catch {
      // not JSON after all
    }
  } else if (isEndName(key)) {
    end(best, key, v);
  }
}

function isEndName(name: string): boolean {
  return END_NAME.test(name) || END_NAME_CAMEL.test(name);
}

function walk(best: Best, node: unknown, depth: number): void {
  if (depth > 6 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(best, n, depth + 1)); return; }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if ((typeof v === 'string' || typeof v === 'number') && isEndName(k)) end(best, k, String(v));
    else walk(best, v, depth + 1);
  }
}

function jwt(best: Best, payload: string): void {
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof claims.exp !== 'number') return;
    best.offer(claims.exp * 1000, typeof claims.iat === 'number' ? claims.iat * 1000 : 0);
  } catch {
    // not a token after all
  }
}

function end(best: Best, name: string, text: string): void {
  if (!text) return;
  const n = Number(text);
  if (!Number.isNaN(n)) {
    if (RELATIVE.test(name)) return; // seconds from an unknown moment
    if (n > 1e9) best.offer(n > 1e11 ? n : n * 1000, 0);
    return;
  }
  const t = Date.parse(text);
  if (!Number.isNaN(t) && /\d{4}-\d{2}-\d{2}T/.test(text)) best.offer(t, 0);
}
