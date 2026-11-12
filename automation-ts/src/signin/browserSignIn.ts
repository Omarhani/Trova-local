import { asObject, asText, Json } from '../trova/json';
import { SignInResult } from '../trova/recipeSignIn';
import { tokensIn } from './jwtValues';

/** the saved values per place, names to values */
export type BrowserValues = SignInResult['browser'];

/** A sign-in the tester made in a real browser, saved for one environment and login. Its values are never printed. */
export interface BrowserSignIn {
  origin: string;
  browser: BrowserValues;
  /** when it was saved (epoch ms, 0 = not known) */
  savedAt: number;
  /** when it ends (epoch ms, 0 = not known) */
  endsAt: number;
}

/** none saved, saved but over (with the plain reason), or ready to use */
export type BrowserLook = { kind: 'none' } | { kind: 'ended'; why: string } | { kind: 'ready'; signIn: BrowserSignIn };

const PLACES = ['localStorage', 'sessionStorage', 'cookies'] as const;

export function endedWords(login: string): string {
  return `The saved browser sign-in of ${login} has ended - sign in again in the browser and save it`;
}

function unreadableWords(login: string): string {
  return `The saved browser sign-in of ${login} could not be read - sign in again in the browser and save it`;
}

/** the one run line about it: whose it is, when it was made, when it ends - never a value */
export function usingLine(login: string, s: BrowserSignIn): string {
  return `Using the saved browser sign-in of ${login} (made ${clock(s.savedAt)}, ends ${clock(s.endsAt)})`;
}

/**
 * The saved file's content as of now (undefined = no file, null = not readable): ready with its whole state, or ended
 * with the plain reason. It ends at expiresAt, else at the first "exp" of any token in its values.
 */
export function lookAt(raw: Json | undefined, login: string, now: number): BrowserLook {
  if (raw === undefined) return { kind: 'none' };
  const file = asObject(raw);
  if (!PLACES.some((p) => file[p] !== undefined)) return { kind: 'ended', why: unreadableWords(login) };
  const browser: BrowserValues = { localStorage: texts(file.localStorage), sessionStorage: texts(file.sessionStorage), cookies: texts(file.cookies) };
  const endsAt = epoch(file.expiresAt) || firstEnd(browser);
  if (endsAt > 0 && now >= endsAt) return { kind: 'ended', why: endedWords(login) };
  return { kind: 'ready', signIn: { origin: asText(file.origin), browser, savedAt: epoch(file.savedAt), endsAt } };
}

/** names to values; a cookie list ([{name, value}]) as names to values */
function texts(place: Json | undefined): Record<string, string> {
  if (Array.isArray(place)) return Object.fromEntries(place.map(asObject).filter((c) => c.name).map((c) => [asText(c.name), asText(c.value)]));
  return Object.fromEntries(Object.entries(asObject(place)).map(([k, v]) => [k, asText(v)]));
}

/** the end of the token that ends first, 0 when none says */
function firstEnd(browser: BrowserValues): number {
  const ends = PLACES.flatMap((p) => Object.values(browser[p])).flatMap(tokensIn).map((t) => t.endsAt).filter((e) => e > 0);
  return ends.length ? Math.min(...ends) : 0;
}

/** a date text or epoch ms / s as epoch ms; 0 for none */
function epoch(value: Json | undefined): number {
  if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** "2026-11-10 21:05" on this computer's clock, "not known" for 0 */
function clock(ms: number): string {
  if (!ms) return 'not known';
  const d = new Date(ms);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
