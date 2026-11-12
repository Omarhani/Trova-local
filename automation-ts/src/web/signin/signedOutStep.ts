import { errors, Page } from '@playwright/test';
import { AiHelpAsk, HelpAnswer, StuckAt, stuckWhere } from './aiHelpAsk';
import { SignInProblem } from '../../report/failureKind';
import { notPast, stillStuck } from '../../run/aiHelp/helpVerdict';
import { testTitle } from '../../run/aiHelp/stuckAt';

/** Round 2: what a case says when the app signed out in the middle of it (never signed in again quietly) */
export const SIGNED_OUT = 'The app signed out in the middle of the case - it stops here; Trova never signs in again quietly during a case';

/** the test side: is the app signed out now, and sign in again (back on `at`); throws plain words when refused */
export interface SignOutWatcher {
  signedOut(page: Page): Promise<boolean>;
  signInAgain(page: Page, at: string): Promise<void>;
}

type Ask = (page: Page, failed: Error, where: StuckAt) => Promise<HelpAnswer | null>;

const STUCK = /not attached to the DOM|intercepts pointer events|element is not (visible|enabled|editable|stable)|element was detached/i;

/** the failures AI help can get a step past: a time-out, a redrawn element, an element not ready or covered */
export function stuck(e: unknown): boolean {
  return e instanceof errors.TimeoutError || (e instanceof Error && (e.name === 'TimeoutError' || STUCK.test(e.message)));
}

function isTimeout(e: unknown): boolean {
  return e instanceof errors.TimeoutError || (e instanceof Error && e.name === 'TimeoutError');
}

/**
 * A step that finds the app signed out in the middle of a test signs in again and is tried once more - the TS twin of
 * utils.SignedOutStep + StuckStep (TICKET-980, Omar 2026-10-23/25). Only a step that failed is checked, only once: a
 * second sign-out in the same case stops it in plain words (Omar 2026-11-10). A step stuck on something else asks AI help (when the
 * run has it) and runs once more. Without a watcher a step fails as it always did.
 */
export class SignedOutStep {
  private watched?: Page;
  private watcher?: SignOutWatcher;
  private at: () => string = () => '';
  /** this case already got its one fresh sign-in */
  private againDone = false;
  /** Round 2: the case may sign in again once (setting); off = a sign-out stops the case BLOCKED */
  private againAllowed = false;

  constructor(private readonly ask: Ask = defaultAsk) {}

  /** watch this page for the rest of the test (undefined = stop watching) */
  watch(page: Page | undefined, w?: SignOutWatcher, at: () => string = () => page?.url() ?? '', signInAgain = false): void {
    this.watched = page;
    this.watcher = w;
    this.at = at;
    this.againDone = false; // a new case: its own one fresh sign-in
    this.againAllowed = signInAgain;
  }

  /** one step's wait or action; signed out = sign in again and once more; stuck = AI help and once more */
  async once<T>(page: Page, step: () => Promise<T>): Promise<T> {
    const w = this.watcher;
    if (!w || page !== this.watched) return this.act(page, step);
    const at = this.at();
    try {
      return await step();
    } catch (failed) {
      if (!stuck(failed)) throw failed;
      if (!isTimeout(failed) || !(await w.signedOut(page).catch(() => false))) return this.help(page, failed as Error, step);
      if (!this.againAllowed) throw new SignInProblem(SIGNED_OUT, { cause: failed });
      if (this.againDone) {
        throw new Error('The app signed out again right after Trova signed in again - the step is not tried a third time', { cause: failed });
      }
      this.againDone = true;
      console.log('The app signed out in the middle of the test - signing in again and trying the step once more');
      await w.signInAgain(page, at);
      return step();
    }
  }

  /** one step's action: stuck = AI help, then the step once more; any other failure as it is */
  async act<T>(page: Page, step: () => Promise<T>): Promise<T> {
    try {
      return await step();
    } catch (failed) {
      if (!stuck(failed)) throw failed;
      return this.help(page, failed as Error, step);
    }
  }

  private async help<T>(page: Page, failed: Error, step: () => Promise<T>): Promise<T> {
    const a = await this.ask(page, failed, { step: stuckWhere(new Error().stack), test: testTitle() });
    if (!a) throw failed;
    if (!a.helped) throw notPast(a, failed, same); // self-healing batch 1: the cause decides (shared with the phone)
    try {
      return await step();
    } catch (again) {
      if (!stuck(again)) throw again;
      throw stillStuck(a, again as Error, same); // self-healing: our own step still cannot - BLOCKED, never the app's fault
    }
  }
}

/** the same kind of failure with the plain reason first (the step's error kept as its cause) */
function same(why: string, cause: Error): Error {
  const e = isTimeout(cause) ? new errors.TimeoutError(why) : new Error(why);
  (e as Error & { cause?: unknown }).cause = cause;
  return e;
}

const helper = new AiHelpAsk();
const defaultAsk: Ask = (page, failed, where) => helper.ask(page, failed, where);

/** the run's one guard: page steps go through stepGuard.once(page, step) */
export const stepGuard = new SignedOutStep();
