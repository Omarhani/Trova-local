import { expect, test } from '@playwright/test';
import { nextSignInStep, SignInScreen } from '../../src/phone/phoneSignInSteps';
import { ScreenSnapshot } from '../../src/phone/screenSnapshot';
import { signOutMessageOf } from '../../src/phone/screens/appSignOutMessage';
import { profileShowsUser } from '../../src/phone/screens/SignedInUser';

const node = (desc: string, cls = 'android.view.View', bounds = '[0,0][10,10]') =>
  `<node text="" resource-id="" class="${cls}" content-desc="${desc}" checkable="false" checked="false" bounds="${bounds}" />`;

/** the realme 7 on 2026-11-11 after hybrid 64 deleted its employee: the app's own sign-out message over home (uiautomator dump) */
const DELETED = `<hierarchy><node text="" resource-id="" class="android.view.View" content-desc="" bounds="[120,963][960,1497]">${
  node('Warning !', 'android.view.View', '[192,1035][888,1101]')}${node('User has been deleted.', 'android.view.View', '[192,1149][888,1209]')}${
  node('Ok', 'android.widget.Button', '[691,1281][888,1425]')}</node></hierarchy>`;

const ARABIC = `<hierarchy>${node('تنبيه !')}${node('تم حذف المستخدم')}${node('حسنًا', 'android.widget.Button')}</hierarchy>`;

/** another Warning of the app (location settings): Cancel + Ok - Ok opens the settings, it is not the sign-out message */
const OTHER_WARNING = `<hierarchy>${node('Warning !')}${node('Precise location is off')}${node('Cancel', 'android.widget.Button')}${
  node('Ok', 'android.widget.Button')}</hierarchy>`;

const SCREEN: SignInScreen = { home: false, servers: [], accountCode: false, userName: false, password: false, next: false, login: false };

test('the app\'s sign-out message (a deleted user) is read with its own words', () => {
  expect(signOutMessageOf(ScreenSnapshot.of(DELETED))).toBe('User has been deleted.');
});

test('the same message in Arabic is read too', () => {
  expect(signOutMessageOf(ScreenSnapshot.of(ARABIC))).toBe('تم حذف المستخدم');
});

test('trap: another warning with more than an Ok is not the sign-out message (never tapped)', () => {
  expect(signOutMessageOf(ScreenSnapshot.of(OTHER_WARNING))).toBeUndefined();
});

test('trap: a home with no message has none', () => {
  expect(signOutMessageOf(ScreenSnapshot.of(`<hierarchy>${node('Welcome Omar')}${node('Self Services', 'android.widget.Button')}</hierarchy>`))).toBeUndefined();
});

test('sign-in: the app\'s sign-out message is closed with Ok first', () => {
  expect(nextSignInStep({ ...SCREEN, signedOutMessage: 'User has been deleted.' }, 'Test', new Set())).toEqual({ kind: 'dismiss' });
});

test('sign-in: a home the run did not sign in to is checked for its user first (another user = signed out)', () => {
  expect(nextSignInStep({ ...SCREEN, home: true }, 'Test', new Set())).toEqual({ kind: 'verify' });
});

test('sign-in: home after the run\'s own log-in, or once its user was checked, is done', () => {
  expect(nextSignInStep({ ...SCREEN, home: true }, 'Test', new Set(['login']))).toEqual({ kind: 'done' });
  expect(nextSignInStep({ ...SCREEN, home: true }, 'Test', new Set(['verified']))).toEqual({ kind: 'done' });
});

test('My Profile shows the user by its user name (any letter case); another user\'s name is not it', () => {
  const descs = ['My profile', 'Omar MobCreateBCD', 'o.hany+mobcreate123@t2.sa'];
  expect(profileShowsUser(descs, 'O.Hany+MobCreate123@t2.sa')).toBe(true);
  expect(profileShowsUser(descs, 'o.hany+mob5@t2.sa')).toBe(false);
  expect(profileShowsUser(['Omar MobCreateBCD\no.hany+mobcreate123@t2.sa'], 'o.hany+mobcreate123@t2.sa')).toBe(true);
});
