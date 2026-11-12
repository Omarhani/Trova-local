import { Page } from '@playwright/test';
import { SignOutWatcher } from './signedOutStep';
import { SignOutSigns } from './signOutSigns';

/** what the watcher stands on: the app's answers, the page is its sign-in / refused page, a quiet sign-in again, the recipe's sign-in address */
export interface MidRunDeps {
  signs: SignOutSigns;
  onSignInPage: (page: Page) => Promise<boolean>;
  again: (page: Page) => Promise<void>;
  signInAddress: () => string;
}

const SIGN_IN_ADDRESS = /[/#](log-?in|sign-?in|signin|auth|sso)([/?#].*)?$/i;

/**
 * The test side of the step guard for a test opened signed in - the TS twin of utils.MidRunSignIn (TICKET-980): after a
 * failed step the app counts as signed out only when one of its calls just answered 401 / 403 about its sign-in, or the
 * page really is its sign-in or refused page (a code or password box in a form is not - Test 8094 run 631); then Trova signs in again (Omar 2026-10-25: only a quiet refresh, never the
 * screen) and goes back to the page the step was on.
 */
export class MidRunSignIn implements SignOutWatcher {
  constructor(private readonly url: string, private readonly login: string, private readonly deps: MidRunDeps) {}

  async signedOut(page: Page): Promise<boolean> {
    if (this.deps.signs.within(30_000)) return true;
    return this.deps.onSignInPage(page);
  }

  async signInAgain(page: Page, at: string): Promise<void> {
    console.log(`Signing in again as ${this.login} without the sign-in page`);
    await this.deps.again(page);
    if (at?.startsWith('http') && at !== this.url && !this.onSignIn(at)) await page.goto(at, { waitUntil: 'domcontentloaded' });
  }

  private onSignIn(at: string): boolean {
    const p = this.deps.signInAddress().replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/\?.*$/, '');
    return (p.length > 2 && at.includes(p)) || SIGN_IN_ADDRESS.test(at);
  }
}
