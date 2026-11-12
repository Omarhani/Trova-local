import type { ConsoleMessage, Page } from '@playwright/test';
import { SignInProblem } from '../../report/failureKind';

/** the robot check's own time-out ("reCAPTCHA Timeout"), in the words the page, its console or its errors use */
const TIMED_OUT = /re-?captcha\W{0,3}(time-?out|timed out)|time-?out\W{0,20}\(?re-?captcha/i;

export function robotTimedOut(text: string): boolean {
  return TIMED_OUT.test(text);
}

/** the page events the watch listens to */
export type PageEvents = Pick<Page, 'on' | 'off'>;

export interface RobotWatch {
  /** settles when the robot check timed out */
  seen: Promise<void>;
  stop(): void;
}

/**
 * Test 8094 run 622: the app's robot check timed out on its sign-in page and the case waited to its 5-minute limit.
 * The watch hears it at once - a console line, a page error, or the page saying it (look, every everyMs).
 */
export function watchRobotTimeout(page: PageEvents, look: () => Promise<string>, everyMs = 500): RobotWatch {
  let done = (): void => undefined;
  const seen = new Promise<void>((resolve) => { done = resolve; });
  const onConsole = (m: ConsoleMessage): void => { if (robotTimedOut(m.text())) done(); };
  const onError = (e: Error): void => { if (robotTimedOut(`${e.name} ${e.message}`)) done(); };
  page.on('console', onConsole);
  page.on('pageerror', onError);
  const timer = setInterval(() => { void look().then((t) => { if (robotTimedOut(t)) done(); }, () => undefined); }, everyMs);
  return {
    seen,
    stop: () => {
      clearInterval(timer);
      page.off('console', onConsole);
      page.off('pageerror', onError);
    },
  };
}

/** the sign-in's work, ended at once with the plain reason (BLOCKED, sign-in) when the robot check times out first */
export async function beforeRobotTimeout<T>(work: Promise<T>, watch: RobotWatch, words: string, abort: AbortController): Promise<T> {
  work.catch(() => undefined); // stopped by the abort after the time-out: its own end is not a second failure
  try {
    return await Promise.race([work, watch.seen.then((): never => {
      abort.abort();
      throw new SignInProblem(words);
    })]);
  } finally {
    watch.stop();
  }
}

/** the plain reason: Trova never gets around a robot check */
export function robotTimeoutWords(app: string, login: string): string {
  return `${app}'s robot check (reCAPTCHA) timed out on its sign-in page, so signing in as ${login} on the screen stopped`
    + " - Trova never gets around a robot check: use the tester's saved browser sign-in (hybrid mode)";
}
