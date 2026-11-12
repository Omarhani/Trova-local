import { expect, test } from '@playwright/test';
import { HttpRequest, HttpSend } from '../../src/api/http';
import { JsonObject } from '../../src/run/runDataFile';
import { recipeUrl, runRecipe } from '../../src/trova/recipeSignIn';

const recipe: JsonObject = {
  apiRoot: 'api', token: 'token',
  calls: [
    { method: 'POST', path: 'Account/GetAccountIdByCode', body: { Data: { code: '{{login:Account code}}' } },
      keep: { account: 'Data', accountId: 'Data.ID' }, refusedWhen: { field: 'Status', is: false, say: 'Message' } },
    { method: 'POST', path: 'User/Login', body: { Data: { AccountID: '{{keep:accountId}}' } },
      keep: { token: 'Data.AccessToken', user: 'Data' }, doneWhen: 'token' },
    { method: 'POST', path: 'User/VerifyCode', body: {}, keep: { token: 'Data.AccessToken' } },
  ],
  browser: [
    { place: 'localStorage', key: 'TOKEN', from: 'token', as: 'json' },
    { place: 'localStorage', key: 'CODE', value: '{{login:Account code}}', as: 'text' },
  ],
};
const fields = { 'Account code': 'ACME' };

function fakeHttp(answers: Record<string, unknown>, seen: HttpRequest[]): HttpSend {
  return async (req) => {
    seen.push(req);
    const key = Object.keys(answers).find((k) => req.url.endsWith(k));
    return { status: 200, text: JSON.stringify(key ? answers[key] : {}) };
  };
}

test('the calls run in order on the API address with /api added once, and the token is kept', async () => {
  const seen: HttpRequest[] = [];
  const http = fakeHttp({ GetAccountIdByCode: { Status: true, Data: { ID: 5 } }, 'User/Login': { Data: { AccessToken: 't1' } } }, seen);
  const result = await runRecipe(recipe, fields, 'https://api.x', http, () => ({}));
  expect(seen.map((r) => r.url)).toEqual(['https://api.x/api/Account/GetAccountIdByCode', 'https://api.x/api/User/Login']);
  expect(JSON.parse(seen[1].body ?? '{}')).toEqual({ Data: { AccountID: 5 } });
  expect(result.token).toBe('t1');
});

test('doneWhen stops before the code step once the token is there', async () => {
  const seen: HttpRequest[] = [];
  await runRecipe(recipe, fields, 'https://api.x', fakeHttp({ 'User/Login': { Data: { AccessToken: 't1' } } }, seen), () => ({}));
  expect(seen).toHaveLength(2);
});

test('the browser keys come from the kept values and the login, json or text', async () => {
  const result = await runRecipe(recipe, fields, 'https://api.x', fakeHttp({ 'User/Login': { Data: { AccessToken: 't1' } } }, []), () => ({}));
  expect(result.browser.localStorage).toEqual({ TOKEN: '"t1"', CODE: 'ACME' });
});

test('an answer with Status false is refused in the app own words', async () => {
  const http = fakeHttp({ GetAccountIdByCode: { Status: false, Message: 'Wrong code' } }, []);
  await expect(runRecipe(recipe, fields, 'https://api.x', http, () => ({}))).rejects.toThrow('Wrong code');
});

test('an HTTP error names the call and its status, never the body sent', async () => {
  const http: HttpSend = async () => ({ status: 401, text: '' });
  await expect(runRecipe(recipe, fields, 'https://api.x', http, () => ({}))).rejects.toThrow('Account/GetAccountIdByCode answered HTTP 401');
});

test('the environment headers go on every call', async () => {
  const seen: HttpRequest[] = [];
  await runRecipe(recipe, fields, 'https://api.x', fakeHttp({ 'User/Login': { Data: { AccessToken: 't' } } }, seen), () => ({ ServiceKey: 'k' }));
  expect(seen.every((r) => r.headers.ServiceKey === 'k')).toBe(true);
});

test('recipeUrl does not add /api when the address already ends with it', () => {
  expect(recipeUrl({ apiRoot: 'api' }, 'User/Login', 'https://x/api/')).toBe('https://x/api/User/Login');
  expect(recipeUrl({ apiRoot: 'api' }, 'https://other/y', 'https://x')).toBe('https://other/y');
});

test('no API address stops in plain words', () => {
  expect(() => recipeUrl({}, 'a', '')).toThrow('No API address');
});
