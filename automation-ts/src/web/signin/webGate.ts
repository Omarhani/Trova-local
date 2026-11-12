import { Page } from '@playwright/test';
import { runMode } from '../../run/runMode';
import { browserSignIns } from '../../signin/browserSignInFile';
import { renewDue } from '../../signin/savedSignIn';
import { runSignInBook } from '../../signin/runSignInBook';
import { SignInGate } from '../../signin/signInGate';
import { apiSignInto } from './apiSignInto';
import { proveSignedIn } from './appProof';
import { putState } from './browserPut';
import { heldLogin, holdLogin } from './heldLogin';
import { captureSaved, putSaved } from './savedState';
import { screenSignInto } from './screenSignInto';

/** the run's sign-in gate on the run's one tab, in the suite's mode (hybrid: the app's API; ui: the sign-in page) */
export function webGate(page: Page, web: string): SignInGate {
  return new SignInGate({
    mode: runMode(),
    book: runSignInBook,
    held: heldLogin,
    hold: holdLogin,
    byApi: (login, fresh) => apiSignInto(page, web, login, fresh),
    byScreen: (login) => screenSignInto(page, web, login),
    browser: (login) => browserSignIns.look(login),
    putBrowser: (saved) => putState(page, saved.browser, saved.origin || new URL(web).origin),
    capture: () => captureSaved(page, web),
    put: (saved) => putSaved(page, saved),
    prove: () => proveSignedIn(page, web),
    renewDue: (saved) => renewDue(saved),
    now: () => Date.now(),
    say: (line) => console.log(line),
  });
}
