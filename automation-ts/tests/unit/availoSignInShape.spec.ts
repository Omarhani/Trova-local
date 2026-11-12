import { expect, test } from '@playwright/test';
import { composeState } from '../../src/web/browserState';
import { runRecipe, SignInResult } from '../../src/trova/recipeSignIn';
import { HttpRequest } from '../../src/trova/http';
import { Json, JsonObject } from '../../src/trova/json';

/**
 * Test 8094 run 679 (web 66, Trova's own sign-in, no saved browser file): User/Login and User/VerifyCode answered 200,
 * then the app's first call (File/DownloadAccountLogo) answered 401 and the app went to /login. The app's request
 * interceptor takes its token from the stored signed-in user (USER -> userData.AccessToken), not from TOKEN - so the
 * browser must get the new token in its user object too, as Java's loginProgrammatically puts USER, ACCOUNT, CODE, TOKEN.
 */

/** Java AvailoApi.encodePassword: each character shifted by the key "Av@il0" (then 'A') plus 107 */
function javaEncodePassword(password: string): string {
  let key = 'Av@il0';
  while (key.length < password.length) key += 'A';
  return [...password].map((c, i) => String.fromCharCode(c.charCodeAt(0) - key.charCodeAt(i) + 107)).join('');
}

/** the Test environment's Admin recipe as Trova keeps it (structure; values here are made up) */
const RECIPE = {
  token: 'k0',
  transforms: { password: { kind: 'char-offsets', rest: 42, offsets: [42, -11, 43, 2, -1, 59, 42, 42, 42, 42, 42, 42] } },
  calls: [
    { path: 'Account/GetAccountIdByCode', method: 'POST', body: { Data: { code: '{{login:Account Code}}' }, Language: 0, TimeZoneOffset: -120 },
      keep: { v0_Data_ID: 'Data.ID' } },
    { path: 'User/Login', method: 'POST', keep: { v1_Data_PhoneNumber: 'Data.PhoneNumber' },
      body: { Data: { password: '{{login:Password>password}}', userName: '{{login:Username}}', AccountID: '{{keep:v0_Data_ID}}', ReCaptchaToken: '' }, Language: 0, TimeZoneOffset: -120 } },
    { path: 'User/VerifyCode', method: 'POST', keep: { k0: 'Data.AccessToken' },
      body: { Data: { Password: '{{login:Password>password}}', UserName: '{{login:Username}}', AccountID: '{{keep:v0_Data_ID}}',
        PhoneNumber: '{{keep:v1_Data_PhoneNumber}}', VerificationCode: '{{login:OTP}}' }, Language: 0, TimeZoneOffset: -120 } },
  ],
  browser: [{ as: 'json', key: 'TOKEN', from: 'k0', place: 'localStorage' }, { key: 'THEME', place: 'localStorage', value: '"light"', ifMissing: true }],
};

const NEW = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJuZXcifQ.bmV3LXNpZ25hdHVyZQ';
const OLD = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvbGQifQ.b2xkLXNpZ25hdHVyZQ';

test('the sign-in calls carry what Java sends: the password encoded the portal\'s way and an empty ReCaptchaToken', async () => {
  const sent: HttpRequest[] = [];
  const answers: Record<string, unknown> = {
    'Account/GetAccountIdByCode': { Status: true, Data: { ID: 'acc-1', AccountName: 'o.hany' } },
    'User/Login': { Status: true, Data: { UserName: 'admin@x', PhoneNumber: '01000000234' } },
    'User/VerifyCode': { Status: true, Data: { UserName: 'admin@x', AccessToken: NEW } },
  };
  const http = async (r: HttpRequest) => {
    sent.push(r);
    const path = Object.keys(answers).find((p) => r.url.endsWith(p))!;
    return { status: 200, text: JSON.stringify(answers[path]), headers: {} };
  };
  const fields = { 'Account Code': 'o.hany', Username: 'admin@x', Password: 'Pass@123', OTP: '0000' };
  const r = await runRecipe(RECIPE as unknown as JsonObject, fields, 'https://api.x/api', http, () => ({}));
  const login = JSON.parse(sent[1].body!).Data;
  expect(login.password).toBe(javaEncodePassword('Pass@123'));
  expect(login.ReCaptchaToken).toBe('');
  expect(login.AccountID).toBe('acc-1');
  expect(JSON.parse(sent[2].body!).Data.Password).toBe(javaEncodePassword('Pass@123'));
  expect(r.token).toBe(NEW);
  expect(r.browser.localStorage.TOKEN).toBe(JSON.stringify(NEW)); // TOKEN as Java puts it (JSON-encoded)
});

test('run 679: a kept signed-in user (USER) carries the NEW token, as the app reads its token from it', () => {
  const api: SignInResult = { token: NEW, browser: { localStorage: { TOKEN: JSON.stringify(NEW) }, sessionStorage: {}, cookies: {} } };
  const kept = { localStorage: {
    TOKEN: JSON.stringify(OLD),
    USER: JSON.stringify({ UserName: 'admin@x', AccessToken: OLD, AccsessGates: [], LastTransaction: null }),
    ACCOUNT: JSON.stringify({ ID: 'acc-1' }), CODE: JSON.stringify('o.hany'),
  } };
  const state = composeState(api, kept, RECIPE.browser as unknown as Json[], []);
  expect(JSON.parse(state.localStorage.USER).AccessToken).toBe(NEW);
  expect(JSON.parse(state.localStorage.TOKEN)).toBe(NEW);
  expect(state.localStorage.ACCOUNT).toBe(JSON.stringify({ ID: 'acc-1' }));
  expect(state.localStorage.CODE).toBe(JSON.stringify('o.hany'));
  expect(JSON.stringify(state)).not.toContain(OLD); // no copy of the old sign-in is left anywhere
  expect(state.localStorage.THEME).toBe('"light"');
});
