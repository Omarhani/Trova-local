import { expect, Page, test } from '@playwright/test';
import { MidRunSignIn } from '../../src/web/signin/midRunSignIn';
import { SignOutSigns } from '../../src/web/signin/signOutSigns';

/** Java utils.MidRunSignIn (TICKET-980): a step that finds the app signed out gets one fresh sign-in, then back to its page. */

test('signed out = a call said the sign-in ran out, or the page really is the sign-in page', async () => {
  const page = {} as Page;
  const signs = new SignOutSigns(() => 1_000);
  let onSignIn = false;
  const mid = new MidRunSignIn('https://app.x/home', 'omar', { signs, onSignInPage: async () => onSignIn, again: async () => undefined, signInAddress: () => '' });
  expect(await mid.signedOut(page)).toBe(false);
  onSignIn = true;
  expect(await mid.signedOut(page)).toBe(true);
  onSignIn = false;
  signs.note(401, '');
  expect(await mid.signedOut(page)).toBe(true);
});

test('a step that only did not find its element is no sign-out: no 401 / 403 and not on the sign-in page (run 631)', async () => {
  const signs = new SignOutSigns(() => 1_000);
  signs.note(200, '{"Data":{"code":"x"}}');
  const mid = new MidRunSignIn('https://app.x/home', 'omar', { signs, onSignInPage: async () => false, again: async () => undefined, signInAddress: () => '' });
  expect(await mid.signedOut({} as Page)).toBe(false);
});

test('after signing in again it goes back to the step\'s page, never to a sign-in address', async () => {
  const went: string[] = [];
  const page = { goto: async (u: string) => { went.push(u); } } as unknown as Page;
  const mid = new MidRunSignIn('https://app.x/home', 'omar', { signs: new SignOutSigns(), onSignInPage: async () => false, again: async () => undefined, signInAddress: () => 'https://app.x/auth/start' });
  await mid.signInAgain(page, 'https://app.x/leaves/7');
  await mid.signInAgain(page, 'https://app.x/home');
  await mid.signInAgain(page, 'https://app.x/login?next=1');
  await mid.signInAgain(page, 'https://app.x/auth/start');
  expect(went).toEqual(['https://app.x/leaves/7']);
});
