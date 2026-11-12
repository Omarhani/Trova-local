import { KIND_NOTE, kindOf } from './failureKind';
import { maskLogText } from './logMask';

/** one try of a case as the reporter sees it */
export interface Attempt {
  /** Playwright's status: passed, failed, timedOut, interrupted, skipped */
  status: string;
  errors: string[];
  skipReason?: string;
  annotations: Array<{ type: string; description?: string }>;
  /** 0 = the first try */
  retry: number;
  /** how many more tries the run allows (Playwright's retries) */
  retries: number;
}

/** what the run screen gets for a try: a note (the case runs once more) and / or its end; nothing = a kept first try */
export interface TryEvents {
  note?: string;
  end?: { status: 'pass' | 'fail' | 'blocked' | 'skip'; msg: string };
}

/** where the reporter leaves its decision for the second try's own process */
export interface TryDecisions {
  allow(testId: string): void;
  keep(testId: string): void;
  allowed(testId: string): boolean;
}

type End = NonNullable<TryEvents['end']>;
const MAX = 400;

/**
 * Round 2 (Omar 2026-11-11): a case that could not run because of a set-up problem (network, phone session, phone
 * server) is tried ONCE more, and the run screen says so on the same row; a wrong app result, a sign-in that ended or
 * was refused and missing data are never tried again - their first result stands.
 */
export class CaseTries {
  private readonly firstTry = new Map<string, string>();

  constructor(private readonly decisions: TryDecisions) {}

  /** a "test" line for this try: only the first - a second try goes on the first one's row, or is not shown at all */
  begins(_testId: string, retry: number): boolean {
    return retry === 0;
  }

  ends(testId: string, a: Attempt): TryEvents {
    const end = verdict(a);
    if (a.retry > 0) return this.later(testId, a.retry, end);
    if (end.status === 'blocked' && setUpKind(a) && a.retries > 0) {
      this.decisions.allow(testId);
      this.firstTry.set(testId, end.msg);
      return { note: `Try 1 of 2 could not run: ${end.msg}. The case runs once more - only a set-up problem is tried again.` };
    }
    if (end.status !== 'pass' && a.retries > 0) this.decisions.keep(testId); // Playwright tries it again: that try steps aside
    return { end };
  }

  /** a later try: the second one ends the row (and no third try runs); a third or a kept first try shows nothing */
  private later(testId: string, retry: number, end: End): TryEvents {
    if (retry > 1 || !this.decisions.allowed(testId)) return {};
    this.decisions.keep(testId); // exactly ONE more try, whatever the run's own try count
    return { end: this.second(testId, end) };
  }

  /** the second try's result, saying what the first try met */
  private second(testId: string, end: End): End {
    const first = this.firstTry.get(testId) ?? 'a set-up problem';
    if (end.status === 'pass') return { status: 'pass', msg: cap(`Passed on the second try - the first try was blocked: ${first}`) };
    if (end.status === 'blocked') return { status: 'blocked', msg: cap(`${end.msg} - blocked on both tries`) };
    return { status: end.status, msg: cap(`${end.msg} (second try; the first try was blocked: ${first})`) };
  }
}

function setUpKind(a: Attempt): boolean {
  return a.status !== 'skipped' && kindOf(a.errors[0] ?? '').kind === 'setup';
}

/** the try's own result: pass, FAILED (the app's answer was wrong), BLOCKED (could not run fairly) or a plain skip */
function verdict(a: Attempt): End {
  if (a.status === 'passed') return { status: 'pass', msg: '' };
  if (a.status === 'skipped') {
    const why = cap(a.skipReason ?? '');
    return a.annotations.some((n) => n.type === KIND_NOTE) ? { status: 'blocked', msg: why } : { status: 'skip', msg: why };
  }
  const k = kindOf(a.errors[0] ?? '');
  return k.kind === 'failed' ? { status: 'fail', msg: cap(k.reason) } : { status: 'blocked', msg: cap(k.reason) };
}

// eslint-disable-next-line no-control-regex
const COLOURS = /\u001b\[[0-9;]*m/g;

/** the reason as the run screen gets it: no colour codes, no token or secret (a call log, a link), at most MAX letters */
const cap = (raw: string): string => {
  const msg = maskLogText(raw.replace(COLOURS, '')).trim();
  return msg.length > MAX ? `${msg.slice(0, MAX)}…` : msg;
};
