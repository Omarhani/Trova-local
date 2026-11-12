/**
 * The app's own calls that say the sign-in ran out - the TS twin of utils.SignOutSigns (TICKET-980): HTTP 401, or 401 /
 * 403 with a message about an expired or invalid token / session. Only the time is kept; of a refused call (4xx) only
 * its short message, to say why a sign-in on the screen did not get through (Java NetworkRecorder.lastRefusal).
 */

const EXPIRED = /(expire|invalid[ _-]?token|token[ _-]?(is[ _-]?)?(invalid|expired|missing)|jwt|unauthori[sz]ed|session|not[ _-]?authenticated|sign(ed)?[ _-]?in|log(ged)?[ _-]?in)/i;
const MESSAGE_FIELDS = ['Message', 'message', 'error_description', 'error', 'detail', 'title', 'msg'];

/** true when the answer says the sign-in ran out */
export function saysSignedOut(status: number, body: string | undefined): boolean {
  if (status !== 401 && status !== 403) return false;
  return !body?.trim() ? status === 401 : EXPIRED.test(body);
}

export class SignOutSigns {
  private last = 0;
  private refusal = { at: 0, said: '' };

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** one answer of the app's calls (its body only for JSON or text answers) */
  note(status: number, body: string | undefined): void {
    if (saysSignedOut(status, body)) this.last = this.now();
    if (status >= 400 && status < 500 && body?.trim()) this.refusal = { at: this.now(), said: messageOf(body) };
  }

  /** a call said the sign-in ran out within the last ms */
  within(ms: number): boolean {
    return this.last > 0 && this.now() - this.last <= ms;
  }

  /** what the app answered when it last refused a call since `since` (its own message), or "" */
  lastRefusal(since: number): string {
    return this.refusal.at >= since ? this.refusal.said : '';
  }
}

/** the answer's own message field when it is JSON, else its text (300 at most) */
function messageOf(body: string): string {
  try {
    const o = JSON.parse(body) as Record<string, unknown>;
    for (const f of MESSAGE_FIELDS) if (typeof o?.[f] === 'string' && (o[f] as string).trim()) return (o[f] as string).trim().slice(0, 300);
  } catch {
    // not JSON: its text
  }
  return body.trim().slice(0, 300);
}

/** the run's one record of the app's answers (fed by the page's network watch) */
export const signOutSigns = new SignOutSigns();
