import { RunMode } from '../run/runMode';
import { BrowserLook, BrowserSignIn, endedWords, usingLine } from './browserSignIn';
import { SavedSignIn } from './savedSignIn';
import { SkipLogin } from './skipLogin';
import { kindOf, SetUpProblem, setUpSaid, SignInProblem, SlowAnswer } from '../report/failureKind';

/** the run's saved sign-ins and refusals, per login name */
export interface SignInBook {
  saved(login: string): SavedSignIn | undefined;
  save(login: string, saved: SavedSignIn): void;
  refused(login: string): string | undefined;
  refuse(login: string, why: string): void;
}

/** what the gate stands on - the browser side is given, so the gate knows no app and no page */
export interface GateDeps {
  mode: RunMode;
  book: SignInBook;
  /** the login the run's tab holds now ('' = none) */
  held: () => string;
  hold: (login: string) => void;
  /** hybrid: the run's API sign-in (fresh = a new one by the app's own calls) put in and proved: null, else why not */
  byApi: (login: string, fresh: boolean) => Promise<string | null>;
  /** full screen mode: the sign-in page with the login's saved steps, proved: null, else why not */
  byScreen: (login: string) => Promise<string | null>;
  /** the sign-in the tester saved from a real browser for this environment and login */
  browser: (login: string) => BrowserLook;
  /** that sign-in's whole state put into the run's tab (no sign-in call) */
  putBrowser: (saved: BrowserSignIn) => Promise<void>;
  /** the browser's whole state now (Playwright storageState + session storage) */
  capture: () => Promise<Omit<SavedSignIn, 'madeAt' | 'fresh'>>;
  put: (saved: SavedSignIn) => Promise<void>;
  /** the app opened and proved signed in: null, else why not ("its calls answered 401") */
  prove: () => Promise<string | null>;
  /** "in 4 min" when the saved sign-in runs out soon, else null */
  renewDue: (saved: SavedSignIn) => string | null;
  now: () => number;
  say: (line: string) => void;
  /** Omar 2026-11-13: the app was seen signed in as login - the run's tick, never before that */
  proved: (login: string) => void;
}

/** run 687: the refusal with expected / seen in plain words ("seen: the sign-in page") */
function refusedWords(login: string, why: string): string {
  const seen = /went to its sign-in page/i.test(why) ? 'the sign-in page' : why;
  return `Expected: the app signed in as ${login} / Actual: ${seen}`; // Omar 2026-11-13: one short Expected / Actual line
}

/**
 * Omar: ONE sign-in per run (Java suite 49 "Emloyess 2"). The first case of a login signs in once - by the app's own
 * API calls in hybrid mode, on the sign-in page in full screen mode - and its state is saved; every later case opens
 * the app with that saved state and proves it is signed in, with no sign-in call. The app refuses it: that case fails
 * with the plain reason and every later case of the login is skipped (no second sign-in, never the sign-in page).
 * Hybrid only: a sign-in that runs out soon, or a sign-out in the middle of a case, gets ONE fresh API sign-in.
 * Omar 2026-11-10: a sign-in the tester made himself in a real browser and saved (the app asks Google's robot check)
 * is used instead of any sign-in, in both modes; it ended or the app refused it = the plain reason, never a new one.
 */
export class SignInGate {
  constructor(private readonly d: GateDeps) {}

  /** the case's app opened signed in as login; throws SkipLogin (skip) or the plain reason (fail) */
  async open(login: string): Promise<void> {
    this.skipIfRefused(login);
    const saved = this.d.book.saved(login);
    if (!saved) return this.signIn(login, 0);
    if (saved.browser && saved.browser.endsAt > 0 && this.d.now() >= saved.browser.endsAt) this.refuse(login, endedWords(login));
    const due = this.d.mode === 'hybrid' && !saved.browser ? this.d.renewDue(saved) : null;
    if (due) {
      this.d.say(`The sign-in of ${login} runs out ${due} - one fresh sign-in by the app's own calls`);
      return this.signIn(login, saved.fresh + 1);
    }
    if (this.d.held() !== login) await this.d.put(saved);
    const why = await this.d.prove();
    if (why) this.refuse(login, saved.browser ? endedWords(login) : refusedWords(login, why));
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(`Opened signed in as ${login} with this run's saved sign-in (no sign-in calls)`);
  }

  /** the app signed out in the middle of a case: one fresh API sign-in (hybrid); full screen mode stops the case */
  async again(login: string): Promise<void> {
    this.skipIfRefused(login);
    if (this.d.book.saved(login)?.browser) this.refuse(login, endedWords(login));
    if (this.d.mode === 'ui') {
      throw new Error(`The app signed ${login} out in the middle of the case - full screen mode signs in once per run, so the case stops here`);
    }
    await this.signIn(login, (this.d.book.saved(login)?.fresh ?? 0) + 1);
  }

  private skipIfRefused(login: string): void {
    const no = this.d.book.refused(login);
    if (no) throw new SkipLogin(no);
  }

  /** the saved browser sign-in, else the mode's one sign-in - proved, then saved for the rest of the run */
  private async signIn(login: string, fresh: number): Promise<void> {
    if (await this.byBrowser(login)) return;
    let why: string | null;
    try {
      why = this.d.mode === 'ui' ? await this.d.byScreen(login) : await this.d.byApi(login, fresh > 0);
    } catch (e) {
      this.signInBroke(login, e);
    }
    // hybrid: the run's API sign-in (case 1's, or made now) is the saved one every case uses
    // run 679: no saved browser file was used here - it is Trova's own sign-in
    if (why) this.refuse(login, refusedWords(login, why));
    this.d.book.save(login, { ...(await this.d.capture()), madeAt: this.d.now(), fresh });
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(fresh ? `Signed in again as ${login} - saved for the rest of the run`
      : `Signed in as ${login} once for this run (${this.d.mode === 'ui' ? 'on the sign-in page' : "by Trova's own API calls"}) - every later case reuses it`);
  }

  /** the sign-in the tester saved in a real browser, put in and proved instead of any sign-in call: false = none saved */
  private async byBrowser(login: string): Promise<boolean> {
    const look = this.d.browser(login);
    if (look.kind === 'none') return false;
    if (look.kind === 'ended') this.refuse(login, look.why);
    await this.d.putBrowser(look.signIn);
    if (await this.d.prove()) this.refuse(login, endedWords(login));
    this.d.book.save(login, { ...(await this.d.capture()), madeAt: this.d.now(), fresh: 0, browser: { endsAt: look.signIn.endsAt } });
    this.d.hold(login);
    this.d.proved(login);
    this.d.say(usingLine(login, look.signIn));
    return true;
  }

  /**
   * the sign-in threw: a network break = a set-up problem (tried once more), the app's page too slow = Not checked in
   * plain words (run 864) - neither refuses the login for the run; anything else is the app refusing it
   */
  private signInBroke(login: string, e: unknown): never {
    const said = e instanceof Error ? e.message : String(e);
    if (setUpSaid(`${e instanceof Error ? e.name : ''}: ${said}`)) throw new SetUpProblem(said);
    const seen = kindOf(`${e instanceof Error ? e.name : 'Error'}: ${said}`);
    if (seen.kind === 'slow') throw new SlowAnswer(seen.reason);
    this.refuse(login, said);
  }

  private refuse(login: string, why: string): never {
    this.d.book.refuse(login, why);
    throw new SignInProblem(why); // BLOCKED: the run's one sign-in ended or was refused - never a second one
  }
}
