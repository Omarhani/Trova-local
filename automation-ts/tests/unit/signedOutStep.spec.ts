import { expect, test } from '@playwright/test';
import { errors, Page } from '@playwright/test';
import { SignedOutStep, stuck } from '../../src/web/signin/signedOutStep';
import { HelpAnswer } from '../../src/web/signin/aiHelpAsk';
import { kindOf, SetUpProblem } from '../../src/report/failureKind';

/** Java utils.SignedOutStep + StuckStep: a step that finds the app signed out signs in again once; a stuck one asks AI help. */

const page = {} as Page;
const timeout = () => new errors.TimeoutError('locator.click: Timeout 5000ms exceeded');

function watcher(out: boolean) {
  const seen = { again: 0, at: '' };
  return { seen, w: { signedOut: async () => out, signInAgain: async (_p: Page, at: string) => { seen.again++; seen.at = at; } } };
}

function failingThen<T>(first: Error, then: T, count = { n: 0 }) {
  return async () => {
    count.n++;
    if (count.n === 1) throw first;
    return then;
  };
}

test('a time-out, a covered click and a redrawn element are stuck; a wrong value is not', () => {
  expect(stuck(timeout())).toBe(true);
  expect(stuck(new Error('element is not attached to the DOM'))).toBe(true);
  expect(stuck(new Error('<div class="overlay"> intercepts pointer events'))).toBe(true);
  expect(stuck(new Error('expected "a" to be "b"'))).toBe(false);
});

test('signed out in the middle of the test: signs in again, back where it was, and the step runs once more', async () => {
  const guard = new SignedOutStep(async () => null);
  const { seen, w } = watcher(true);
  guard.watch(page, w, () => 'https://app.x/leaves', true);
  const count = { n: 0 };
  expect(await guard.once(page, failingThen(timeout(), 'done', count))).toBe('done');
  expect(count.n).toBe(2);
  expect(seen).toEqual({ again: 1, at: 'https://app.x/leaves' });
});

test('signed out again within a minute: the step is not tried a third time', async () => {
  let now = 100_000;
  const guard = new SignedOutStep(async () => null);
  guard.watch(page, watcher(true).w, () => 'https://app.x/a', true);
  await guard.once(page, failingThen(timeout(), 1));
  now += 59_000;
  await expect(guard.once(page, failingThen(timeout(), 1)))
    .rejects.toThrow('The app signed out again right after Trova signed in again - the step is not tried a third time');
});

test('a second sign-out in the same case fails it even an hour later: one fresh sign-in per case', async () => {
  let now = 100_000;
  const guard = new SignedOutStep(async () => null);
  const { seen, w } = watcher(true);
  guard.watch(page, w, () => 'https://app.x/a', true);
  await guard.once(page, failingThen(timeout(), 1));
  now += 3_600_000;
  await expect(guard.once(page, failingThen(timeout(), 1))).rejects.toThrow('The app signed out again');
  expect(seen.again).toBe(1);
});

test('the next case starts with its own one fresh sign-in', async () => {
  const guard = new SignedOutStep(async () => null);
  const { seen, w } = watcher(true);
  guard.watch(page, w, () => 'https://app.x/a', true);
  await guard.once(page, failingThen(timeout(), 1));
  guard.watch(page, w, () => 'https://app.x/b', true); // the next case
  expect(await guard.once(page, failingThen(timeout(), 2))).toBe(2);
  expect(seen.again).toBe(2);
});

test('Round 2 default: a real sign-out in the middle of a case stops it BLOCKED with the reason - never signed in again quietly', async () => {
  const guard = new SignedOutStep(async () => null);
  const { seen, w } = watcher(true);
  guard.watch(page, w, () => 'https://app.x/leaves');
  const failed = guard.once(page, failingThen(timeout(), 'done'));
  await expect(failed).rejects.toThrow('signed out in the middle of the case');
  await expect(failed).rejects.toMatchObject({ name: 'SignInProblem' });
  expect(seen.again).toBe(0);
});

test('a failure that is not stuck fails as it is - no sign-in, no AI help', async () => {
  let asked = 0;
  const guard = new SignedOutStep(async () => { asked++; return null; });
  const { seen, w } = watcher(true);
  guard.watch(page, w, () => '');
  await expect(guard.once(page, failingThen(new Error('wrong total'), 1))).rejects.toThrow('wrong total');
  expect(seen.again).toBe(0);
  expect(asked).toBe(0);
});

test('stuck but not signed out: AI help gets it past and the step runs once more', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: true, did: 'closed the news dialog' }));
  guard.watch(page, watcher(false).w, () => '');
  expect(await guard.once(page, failingThen(timeout(), 'ok'))).toBe('ok');
});

test('AI help could not get past it: the plain reason first, the step\'s error after it', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: false, did: '', why: 'AI help could not get past it: no button' }));
  await expect(guard.act(page, failingThen(timeout(), 1)))
    .rejects.toThrow('AI help could not get past it: no button - locator.click: Timeout 5000ms exceeded');
});

test('still stuck after AI help says what the AI did', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: true, did: 'scrolled down' }));
  const always = async () => { throw timeout(); };
  await expect(guard.act(page, always)).rejects.toThrow('Still stuck after AI help (scrolled down) - locator.click: Timeout 5000ms exceeded');
});

test('no AI help in this run: a stuck step fails as it always did', async () => {
  const guard = new SignedOutStep(async () => null);
  await expect(guard.act(page, failingThen(timeout(), 1))).rejects.toThrow('Timeout 5000ms exceeded');
});

test('another page than the watched one is never signed in again', async () => {
  const guard = new SignedOutStep(async () => null);
  const { seen, w } = watcher(true);
  guard.watch({} as Page, w, () => '');
  await expect(guard.once(page, failingThen(timeout(), 1))).rejects.toThrow('Timeout');
  expect(seen.again).toBe(0);
});

/** Self-healing batch 1 (Omar 2026-11-11): the stuck step's cause decides how the case ends */
test('the AI saw the app wrong: the case FAILS as a real bug - Expected / Actual with what it saw, never got past', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: false, did: 'the app showed an error', cause: 'APP', proof: 'the app said "Server error 500"' }));
  const e = await guard.act(page, failingThen(timeout(), 1)).catch((x: Error) => x);
  expect((e as Error).message).toBe('Expected: this step goes on / Actual: the app said "Server error 500"');
  expect(kindOf(`Error: ${(e as Error).message}`).kind).toBe('failed');
});

test('the network or the browser let it down: the case is BLOCKED with what the AI saw', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: false, did: '', cause: 'ENVIRONMENT', proof: 'the page never loaded - no connection' }));
  const e = await guard.act(page, failingThen(timeout(), 1)).catch((x: Error) => x);
  expect(e).toBeInstanceOf(SetUpProblem);
  expect((e as Error).message).toBe('The test could not finish - the network, browser or computer let it down: the page never loaded - no connection');
});

test('our own step was stuck and the AI could not get past it: BLOCKED "needs a look", never a failure of the app', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: false, did: 'no menu', cause: 'OUR_CODE', proof: 'the menu item is named differently now' }));
  const e = await guard.act(page, failingThen(timeout(), 1)).catch((x: Error) => x);
  expect(e).toBeInstanceOf(SetUpProblem);
  expect((e as Error).message).toBe('The test needs an update - the app looks fine: the menu item is named differently now');
});

test('our own step still stuck after the AI got past it (a renamed element): BLOCKED "needs a look", never FAILED', async () => {
  const guard = new SignedOutStep(async (): Promise<HelpAnswer> => ({ helped: true, did: 'clicked the Work plans link itself', cause: 'OUR_CODE', proof: 'the link is named differently on the page' }));
  const always = async () => { throw timeout(); };
  const e = await guard.act(page, always).catch((x: Error) => x);
  expect(e).toBeInstanceOf(SetUpProblem);
  expect((e as Error).message).toBe('The test needs an update - the app looks fine: the link is named differently on the page');
});
