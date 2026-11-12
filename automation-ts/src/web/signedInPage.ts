import { Page } from '@playwright/test';
import { testData } from '../run/testData';
import { MidRunSignIn } from './signin/midRunSignIn';
import { screenRecipe } from './signin/keptSignIn';
import { stepGuard } from './signin/signedOutStep';
import { onSignInPage } from './signin/signedOutPage';
import { signOutSigns } from './signin/signOutSigns';
import { webGate } from './signin/webGate';
import { param } from '../run/blockParams';

/** Round 2 setting: <parameter name="signOutInCase" value="sign in again"/> allows one fresh sign-in; default = the case stops */
function signInAgainInCase(): boolean {
  try {
    return /again/i.test(param('signOutInCase', 'stop'));
  } catch {
    return false;
  }
}

/**
 * The case's app opened signed in as login in the run's ONE browser, with the run's ONE sign-in of that login (Omar,
 * Java utils.SignedInRun): made once on first use and saved, reused by every later case with no sign-in call, proved
 * before any step counts (SignInGate). The page is then watched: a step that finds the app signed out gets one fresh
 * sign-in and is tried once more (MidRunSignIn, hybrid only). Never the sign-in page in hybrid mode.
 */
export async function openSignedInOn(page: Page, login: string): Promise<void> {
  const web = testData.webUrl();
  if (!web) throw new Error(`No web address for the ${testData.env()} environment: add it in Trova > Test Data > Environments`);
  const gate = webGate(page, web);
  await gate.open(login);
  const recipe = screenRecipe(login);
  const start = recipe ? String(recipe.url ?? '') : undefined;
  stepGuard.watch(page, new MidRunSignIn(web, login, {
    signs: signOutSigns,
    onSignInPage: (p) => onSignInPage(p, start),
    again: () => gate.again(login),
    signInAddress: () => start ?? '',
  }), undefined, signInAgainInCase());
}
