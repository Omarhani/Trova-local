import { expect, test } from '@playwright/test';
import { reportedSend } from '../../src/api/reportedSend';
import { RecordNames } from '../../src/report/recordNames';
import { HttpRequest } from '../../src/trova/http';

const login: HttpRequest = { method: 'POST', url: 'https://a.sa/api/Login', headers: { Authorization: 'Bearer secret-1' },
  body: '{"UserName":"o","Password":"p"}' };

test("the test's own API call (a sign-in among them) is on Network as an API call, password and token masked, no header", async () => {
  const said: Array<[string, Record<string, unknown>]> = [];
  const send = reportedSend(async () => ({ status: 200, text: '{"Token":"eyJ1"}' }), (t, f) => said.push([t, f]), new RecordNames());
  expect(await send(login)).toEqual({ status: 200, text: '{"Token":"eyJ1"}' });
  expect(said.map(([t]) => t)).toEqual(['step', 'call']); // run 633: a call that does something is a step with its values
  expect(said[0][1]).toMatchObject({ a: 'api', e: 'Login - User name "o", Password "***" (by API)' });
  expect(said[1][1]).toMatchObject({ m: 'POST', p: '/api/Login', s: 200, api: true, req: '{"UserName":"o","Password":"***"}', res: '{"Token":"***"}' });
  expect(JSON.stringify(said)).not.toContain('secret-1');
});

test('a call that got no answer is on Network as failed and its error still reaches the test', async () => {
  const said: Array<[string, Record<string, unknown>]> = [];
  const send = reportedSend(async () => { throw new Error('The call /api/Login did not answer (TimeoutError)'); }, (t, f) => said.push([t, f]));
  await expect(send(login)).rejects.toThrow('did not answer');
  expect(said.find(([t]) => t === 'call')?.[1]).toMatchObject({ s: 0, bad: true, err: 'The call /api/Login did not answer (TimeoutError)', api: true });
});

// Test 8094 run 642: the delete step names the employee the run found before, never its id
test('a record the run read by API is named in a later step; its id stays in Network only', async () => {
  const said: Array<[string, Record<string, unknown>]> = [];
  const id = '18e2d105-9613-4c1e-9a55-0d1f2b3c4d5e';
  const list = JSON.stringify({ Data: { List: [{ UserId: id, FirstName: 'Ali', LastName: 'Test', UserName: 'ali.test' }] } });
  const answer = async (r: HttpRequest) => ({ status: 200, text: r.url.endsWith('GetAllUser') ? list : '{"Result":true}' });
  const send = reportedSend(answer, (t, f) => said.push([t, f]), new RecordNames());
  await send({ method: 'POST', url: 'https://a.sa/api/User/GetAllUser', headers: {}, body: '{"Data":{"SearchTerm":"ali.test"}}' });
  await send({ method: 'POST', url: 'https://a.sa/api/User/Delete', headers: {}, body: JSON.stringify({ Data: { UserId: id } }) });
  expect(said.filter(([t]) => t === 'step').map(([, f]) => f.e)).toEqual(['Delete user "Ali Test" (by API)']);
  expect(said.filter(([t]) => t === 'call').map(([, f]) => String(f.req)).join(' ')).toContain(id);
});
