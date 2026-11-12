import { onStandIn } from '../web/signin/standIn';

/**
 * The run screen's Network and Problems rows, the same "call" / "open" events and fields the Java helpers send
 * (utils.LiveFeed.network / apiCall), with the same masking: a token, password or verification code never leaves the
 * run - in an address (utils.TestTimeline.maskUrl) or a body (utils.ApiReport.mask). Cookies and auth headers are never
 * sent at all.
 */

/** what one call was: as the browser or the API client saw it */
export interface CallFacts {
  method: string;
  url: string;
  /** when it was sent (epoch ms) */
  sent: number;
  /** HTTP status; 0 = no answer */
  status: number;
  ms: number;
  request?: string;
  response?: string;
  /** why it got no answer ("" = it got one) */
  error?: string;
}

const URL_SECRET = /((?:token|password|verificationcode|[?&]otp|[?&]pin)=)[^&]*/gi;
const BODY_SECRET = /("(?:[a-z_]*(?:password|token|verificationcode|secret)[a-z_]*|otp[a-z_]*|pin|pincode)"\s*:\s*)("[^"]*"|\d+)/gi;
/** the page's monitoring, not its work (utils.NetworkRecorder.NOISE) */
const NOISE = /^https?:\/\/[^/]*(google|gstatic|doubleclick|clarity\.ms|hotjar|lr-ingest|logrocket|mixpanel|eum\.)[^/]*\/.*/;
const BODY_OK = 1000;
const BODY_FAILED = 4000;

export function maskUrl(url: string): string {
  return (url ?? '').replace(URL_SECRET, '$1***');
}

export function pathOf(url: string): string {
  const p = maskUrl(url).replace(/^https?:\/\/[^/]+/, '');
  return p === '' ? '/' : p;
}

export function maskBody(text: string): string {
  return text.replace(BODY_SECRET, '$1"***"');
}

/** the server's own words: its Status flag and Message, else the first validation error, else title / detail (AppReason) */
export function serverSaid(body: string | undefined): { ss: boolean | undefined; msg: string } {
  let o: Record<string, unknown>;
  try {
    const json = JSON.parse(body ?? '') as unknown;
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return { ss: undefined, msg: '' };
    o = json as Record<string, unknown>;
  } catch {
    return { ss: undefined, msg: '' };
  }
  const ss = typeof o.Status === 'boolean' ? o.Status : undefined;
  const text = (v: unknown): string => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return { ss, msg: text(o.Message) || text(o.message) || firstError(o.errors) || text(o.title) || text(o.detail) };
}

function firstError(errors: unknown): string {
  if (errors === null || typeof errors !== 'object') return '';
  for (const v of Object.values(errors as Record<string, unknown>)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return '';
}

/** a body for the page: compact JSON as sent, masked, shortened with how much more there was */
function body(text: string | undefined, max: number): string | null {
  if (!text) return null;
  let compact = text;
  try { compact = JSON.stringify(JSON.parse(text)); } catch { /* not JSON - as it is */ }
  compact = maskBody(compact);
  return compact.length <= max ? compact : `${compact.slice(0, max)} ... (${compact.length - max} more characters)`;
}

function cap(text: string, max: number): string {
  const line = text.replace(/[\r\n]/g, ' ');
  return line.length <= max ? line : `${line.slice(0, max)}...`;
}

/** the "call" event of one call; api = a call the test's own API client made (set-up, clean-up) */
export function callEvent(c: CallFacts, api = false): Record<string, unknown> {
  const said = serverSaid(c.response);
  const bad = c.status >= 400 || c.status === 0 || Boolean(c.error);
  const warn = !bad && said.ss === false;
  const max = bad || warn ? BODY_FAILED : BODY_OK;
  return {
    m: c.method, p: pathOf(c.url), url: maskUrl(c.url), sent: c.sent, s: c.status, ms: Math.round(c.ms), bad, warn,
    ss: said.ss, msg: cap(said.msg, 300), err: c.error ?? '', done: true, req: body(c.request, max), res: body(c.response, max),
    ...(api ? { api: true } : {}),
  };
}

/** the "open" event of a page load */
export function openEvent(c: CallFacts): Record<string, unknown> {
  return { p: pathOf(c.url), url: maskUrl(c.url), sent: c.sent, s: c.status, ms: Math.round(c.ms),
    bad: c.status >= 400 || c.status === 0 || Boolean(c.error), err: c.error ?? '' };
}

/** the page's own calls and loads: xhr / fetch / documents on http(s), no OPTIONS, files, assets or monitoring */
export function wantedCall(resourceType: string, url: string, method: string): boolean {
  if (!/^https?:/i.test(url) || method.toUpperCase() === 'OPTIONS') return false;
  if (!['xhr', 'fetch', 'document'].includes(resourceType)) return false;
  const u = url.toLowerCase();
  if (onStandIn(url)) return false; // Trova's own sign-in stand-in: never shown to customers
  return !u.includes('/assets/') && !u.includes('/intake/v2/rum/') && !NOISE.test(u);
}
