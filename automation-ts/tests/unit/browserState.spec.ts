import { expect, test } from '@playwright/test';
import { composeState } from '../../src/web/browserState';
import { SignInResult } from '../../src/trova/recipeSignIn';

/** Test 8094 run 574: the TS run opened the portal without its page settings (language ...) - the menu link was not there. */
const api: SignInResult = { token: 't', browser: { localStorage: { TOKEN: '"t"' }, sessionStorage: {}, cookies: { sid: 'new' } } };

test('the kept full state stays and the API sign-in keys go over it', () => {
  const kept = { localStorage: { TOKEN: '"old"', THEME: '"dark"' }, sessionStorage: { tab: '1' }, cookies: [{ name: 'sid', value: 'old' }] };
  const s = composeState(api, kept, [], []);
  expect(s.localStorage).toEqual({ TOKEN: '"t"', THEME: '"dark"' });
  expect(s.sessionStorage).toEqual({ tab: '1' });
  expect(s.cookies).toEqual({ sid: 'new' });
});

test('page settings of the sign-in page go in only where the key is missing', () => {
  const settings = [{ place: 'localStorage', key: 'lang', value: 'ar', ifMissing: true }, { place: 'localStorage', key: 'THEME', value: 'light', ifMissing: true }];
  const s = composeState(api, { localStorage: { THEME: '"dark"' } }, settings, []);
  expect(s.localStorage.lang).toBe('ar');
  expect(s.localStorage.THEME).toBe('"dark"');
});

test('Test Data browser storage goes on top of everything (same name = Test Data wins)', () => {
  const storage = [{ type: 'LOCAL', name: 'THEME', value: 'new' }, { type: 'SESSION', name: 'm', value: '2' }, { type: 'COOKIE', name: 'sid', value: 'td' }];
  const s = composeState(api, { localStorage: { THEME: '"dark"' } }, [], storage);
  expect(s.localStorage.THEME).toBe('new');
  expect(s.sessionStorage.m).toBe('2');
  expect(s.cookies.sid).toBe('td');
});

test('no kept state, settings or storage = the API keys alone', () => {
  const s = composeState(api, undefined, [], []);
  expect(s).toEqual({ localStorage: { TOKEN: '"t"' }, sessionStorage: {}, cookies: { sid: 'new' } });
});

test('a recipe entry that is not a page setting is not added again', () => {
  const s = composeState(api, undefined, [{ place: 'localStorage', key: 'X', value: 'v' }], []);
  expect(s.localStorage.X).toBeUndefined();
});

test('two tries like the Java helpers (SignedInBrowser.put): the kept state with the API keys, then the API keys alone (Test 8094 run 599)', async () => {
  const { composeStates } = await import('../../src/web/browserState');
  const kept = { localStorage: { tenant: 'old', token: 'stale' } };
  const tries = composeStates(api, kept, [], []);
  expect(tries).toHaveLength(2);
  expect(tries[0].localStorage.tenant).toBe('old');
  expect(tries[1].localStorage.tenant).toBeUndefined();
  expect(tries[1].localStorage.TOKEN).toBe('"t"');
});

test('no kept state: one try only', async () => {
  const { composeStates } = await import('../../src/web/browserState');
  expect(composeStates(api, undefined, [], [])).toHaveLength(1);
});
