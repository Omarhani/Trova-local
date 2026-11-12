import { expect, test } from '@playwright/test';
import { nextSignInStep, SignInScreen } from '../../src/phone/phoneSignInSteps';

/** Test 8094 run 576: the app started on the account-code / server screen (Live ticked) - every start screen is handled. */
const empty: SignInScreen = { home: false, servers: [], accountCode: false, userName: false, password: false, next: false, login: false };

/** run 658: a kept home can be another user's (one the server dropped) - its user is checked first, then nothing more */
test('a phone already signed in has its user checked, then does nothing more', () => {
  expect(nextSignInStep({ ...empty, home: true }, 'Test', new Set())).toEqual({ kind: 'verify' });
  expect(nextSignInStep({ ...empty, home: true }, 'Test', new Set(['verified']))).toEqual({ kind: 'done' });
});

test('the run environment server box is ticked first when another one is ticked', () => {
  const s = { ...empty, servers: [{ name: 'Live', checked: true }, { name: 'Test', checked: false }], accountCode: true };
  expect(nextSignInStep(s, 'Test', new Set())).toEqual({ kind: 'tick', server: 'Test' });
});

test('another ticked server box is unticked once the run one is ticked', () => {
  const s = { ...empty, servers: [{ name: 'Live', checked: true }, { name: 'Test', checked: true }], accountCode: true };
  expect(nextSignInStep(s, 'Test', new Set())).toEqual({ kind: 'untick', server: 'Live' });
});

test('then the account code, once', () => {
  const s = { ...empty, servers: [{ name: 'Test', checked: true }], accountCode: true, next: true };
  expect(nextSignInStep(s, 'Test', new Set())).toEqual({ kind: 'accountCode' });
  expect(nextSignInStep(s, 'Test', new Set(['accountCode']))).toEqual({ kind: 'next' });
});

test('user name and password, then log in', () => {
  const s = { ...empty, userName: true, password: true, login: true };
  expect(nextSignInStep(s, 'Test', new Set(['accountCode']))).toEqual({ kind: 'credentials' });
  expect(nextSignInStep(s, 'Test', new Set(['accountCode', 'credentials']))).toEqual({ kind: 'login' });
});

test('account code and user boxes on one screen: code, then user and password, then log in', () => {
  const s = { ...empty, servers: [{ name: 'Test', checked: true }], accountCode: true, userName: true, password: true, login: true };
  expect(nextSignInStep(s, 'Test', new Set())).toEqual({ kind: 'accountCode' });
  expect(nextSignInStep(s, 'Test', new Set(['accountCode']))).toEqual({ kind: 'credentials' });
});

test('trap: no server box named like the environment is never guessed', () => {
  const s = { ...empty, servers: [{ name: 'Live', checked: true }, { name: 'Stage', checked: false }], accountCode: true };
  expect(nextSignInStep(s, 'Test', new Set())).toEqual({ kind: 'stop', why: 'The app has no server called "Test" (it shows Live, Stage)' });
});

test('a screen with nothing known yet waits', () => {
  expect(nextSignInStep(empty, 'Test', new Set())).toEqual({ kind: 'wait' });
});

/** Test 8094 run 645: after the app's data was cleared, Android asked for the location - the sign-in waited 90 s on it */
test('the system permission question is answered first (allow while using the app), even on home', () => {
  expect(nextSignInStep({ ...empty, userName: true, login: true, permission: true }, 'Test', new Set(['accountCode', 'credentials']))).toEqual({ kind: 'allow' });
  expect(nextSignInStep({ ...empty, home: true, permission: true }, 'Test', new Set())).toEqual({ kind: 'allow' });
});

test('a refusal the app shows after Log in stops the sign-in with the app\'s own words', () => {
  const s = { ...empty, userName: true, password: true, login: true, refused: 'Invalid user name or password' };
  expect(nextSignInStep(s, 'Test', new Set(['accountCode', 'credentials', 'login'])))
    .toEqual({ kind: 'stop', why: 'The app refused the sign-in: "Invalid user name or password" - check the login in Test Data > Credentials' });
});

test('boundary: a message before Log in was pressed is not taken as a refusal', () => {
  const s = { ...empty, userName: true, password: true, login: true, refused: 'Something' };
  expect(nextSignInStep(s, 'Test', new Set(['accountCode', 'credentials']))).toEqual({ kind: 'login' });
});
