/**
 * Round 2 (Omar 2026-11-11): why a TS case did not pass, in one of four kinds. "failed" = the app's result was wrong
 * (FAILED, never tried again); "setup" = the network, the phone session, the phone server or the test program let the
 * case down (BLOCKED, tried once more); "signin" = the run's one sign-in ended or was refused (BLOCKED, never a second
 * sign-in); "data" = a record the case needs is missing (BLOCKED, naming it).
 */
export type Kind = 'failed' | 'setup' | 'signin' | 'data' | 'slow';

/** the annotation a skipped case carries to say why it could not run (the live reporter reads it) */
export const KIND_NOTE = 'trova-kind';

export class SetUpProblem extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SetUpProblem';
  }
}

export class SignInProblem extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(reason, options);
    this.name = 'SignInProblem';
  }
}

/** run 687: the app's answer did not come in time - not a wrong result, not a set-up problem: BLOCKED, never tried again */
export class SlowAnswer extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(reason, options);
    this.name = 'SlowAnswer';
  }
}

export class MissingData extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'MissingData';
  }
}

const NAMED: Record<string, Kind> = { SetUpProblem: 'setup', SignInProblem: 'signin', SkipLogin: 'signin', MissingData: 'data', SlowAnswer: 'slow' };

/** set-up problems the drivers report in their own words: a pattern and the plain sentence for it */
const SETUP: Array<{ seen: RegExp; say: string }> = [
  { seen: /The phone connection closed during the case/i, say: '' }, // already plain (phoneGone)
  { seen: /:4723\b|Appium did not start|phone server \(Appium\)/i, say: 'The phone server (Appium) stopped answering - not the app\'s answer' },
  { seen: /invalid session id|session is either terminated or not started|instrumentation process is not running|cannot be proxied to UiAutomator2/i,
    say: 'The phone session was lost during the case - not the app\'s answer' },
  // run 717: the phone dropped off its cable mid-case - Appium could not reach it (before the network rule: its words hold "socket hang up")
  { seen: /Could not proxy command to the remote server|Cannot execute the 'pidof' shell command|device '?[\w.:-]*'? (not found|offline)|no devices\/emulators found/i,
    say: 'The phone was disconnected during the case (its cable or USB link dropped) - not the app\'s answer' },
  // run 747: the app's page froze (frozenPage closed it) / the run's browser no longer answered its DevTools link
  { seen: /The page stopped answering for \d+ s/i, say: 'The page stopped answering (its own script was busy) - not the app\'s answer' },
  { seen: /connectOverCDP|retrieving websocket url/i, say: 'The run\'s browser stopped answering - not the app\'s answer' },
  { seen: /\b(ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH)\b|socket hang up|fetch failed|net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_\w+|NETWORK_CHANGED|TIMED_OUT|ADDRESS_UNREACHABLE)/i,
    say: 'The app\'s server could not be reached (a network problem on the way) - not the app\'s answer' },
  { seen: /Worker process exited unexpectedly|Target page, context or browser has been closed/i,
    say: 'The test program or its browser stopped during the case - not the app\'s answer' },
];

/** a page that did not load: "page.goto: Timeout 30000ms exceeded" (goto, reload, back, forward, waitForURL) */
const PAGE_LOAD = /page\.(?:goto|reload|goBack|goForward|waitForURL): Timeout (\d+)ms exceeded/;

// eslint-disable-next-line no-control-regex
const COLOURS = /\u001b\[[0-9;]*m/g;

/** the kind of a case's first error (Playwright's "Name: message") and its reason in plain words */
export function kindOf(error: string): { kind: Kind; reason: string } {
  const text = error.replace(COLOURS, '').trim();
  const named = /^(\w+):\s*([\s\S]*)$/.exec(text);
  const own = named ? NAMED[named[1]] : undefined;
  if (own === 'signin' && setUpSaid(text)) return { kind: 'setup', reason: plainSetUp(text, named![2].trim()) }; // the network broke, nobody refused
  if (own) return { kind: own, reason: named![2].trim() };
  const said = named ? named[2].trim() : text;
  if (/^Not tested - needs /.test(said)) return { kind: 'data', reason: said };
  const first = said.split('\n')[0];
  if (first.includes('✗')) return { kind: 'failed', reason: text }; // a check saw a wrong value: never a set-up problem
  const load = PAGE_LOAD.exec(first); // run 821: the app's page did not load in time - not checked, never the tool's words
  if (load) return { kind: 'slow', reason: `The app's page did not open within ${Math.round(Number(load[1]) / 1000)} s - not the app's answer` };
  return setUpSaid(text) ? { kind: 'setup', reason: plainSetUp(text, said) } : { kind: 'failed', reason: text };
}

/** the error names a set-up problem (network, phone session, phone server, crashed test program) */
export function setUpSaid(text: string): boolean {
  return SETUP.some((s) => s.seen.test(text));
}

function plainSetUp(text: string, said: string): string {
  const first = said.split(/\r?\n/)[0];
  const s = SETUP.find((x) => x.seen.test(text));
  return s?.say ? `${s.say} · seen: ${first.slice(0, 200)}` : first;
}
