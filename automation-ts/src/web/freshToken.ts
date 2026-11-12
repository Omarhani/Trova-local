import type { BrowserState } from './browserState';

/** a signed token (JWT) on its own */
const SIGNED = /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/;
/** a field that holds the app's sign-in token in a stored object (USER.AccessToken, user.token ...) */
const TOKEN_FIELD = /^(access_?token|token|auth_?token|id_?token)$/i;

/**
 * Test 8094 run 679: the app reads its token from the signed-in user it keeps (Availo: USER.AccessToken, the request
 * interceptor's userData) - a kept copy of that user still held the OLD token, so the app's first call answered 401
 * and it went to its sign-in page (Java puts USER with the new token, AvailoApi.login + UtilsTests.loginProgrammatically).
 * Every stored copy of the old token - a value on its own or a token field of a stored object - gets the new one.
 */
export function withFreshToken(state: BrowserState, token: string): BrowserState {
  if (!token) return state;
  const out: BrowserState = { localStorage: {}, sessionStorage: {}, cookies: {} };
  for (const place of ['localStorage', 'sessionStorage', 'cookies'] as const) {
    for (const [k, v] of Object.entries(state[place])) out[place][k] = freshValue(v, token);
  }
  return out;
}

function freshValue(value: string, token: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return SIGNED.test(value) ? token : value;
  }
  const fresh = freshJson(parsed, token);
  return fresh.changed ? JSON.stringify(fresh.value) : value;
}

function freshJson(v: unknown, token: string, field = ''): { value: unknown; changed: boolean } {
  if (typeof v === 'string') return SIGNED.test(v) && v !== token && (field === '' || TOKEN_FIELD.test(field)) ? { value: token, changed: true } : { value: v, changed: false };
  if (Array.isArray(v)) {
    const items = v.map((x) => freshJson(x, token));
    return { value: items.map((i) => i.value), changed: items.some((i) => i.changed) };
  }
  if (v && typeof v === 'object') {
    let changed = false;
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const f = freshJson(x, token, k);
      o[k] = f.value;
      changed ||= f.changed;
    }
    return { value: o, changed };
  }
  return { value: v, changed: false };
}
