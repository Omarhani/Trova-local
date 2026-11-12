import { expect, test } from '@playwright/test';
import { HttpAnswer } from '../../src/api/http';
import { sendSignedIn } from '../../src/api/signedSend';

const answer = (status: number): HttpAnswer => ({ status, text: '', headers: {} } as unknown as HttpAnswer);

function app(statuses: number[]) {
  const sentWith: string[] = [];
  let token = 'run-token';
  let resigns = 0;
  return {
    sentWith,
    resigns: () => resigns,
    send: async (t: string) => { sentWith.push(t); return answer(statuses.shift() ?? 200); },
    token: () => token,
    resign: async () => { resigns++; token = 'new-token'; },
  };
}

test('a call the app answers is sent once, with the run\'s sign-in', async () => {
  const a = app([200]);
  expect((await sendSignedIn(a.send, a.token, a.resign)).status).toBe(200);
  expect(a.sentWith).toEqual(['run-token']);
  expect(a.resigns()).toBe(0);
});

test('the app dropped the run\'s sign-in (401): signed in anew once and the call sent again', async () => {
  const a = app([401, 200]);
  expect((await sendSignedIn(a.send, a.token, a.resign)).status).toBe(200);
  expect(a.sentWith).toEqual(['run-token', 'new-token']);
  expect(a.resigns()).toBe(1);
});

test('still 401 after a new sign-in: that answer is given back, never a loop', async () => {
  const a = app([401, 401]);
  expect((await sendSignedIn(a.send, a.token, a.resign)).status).toBe(401);
  expect(a.resigns()).toBe(1);
  expect(a.sentWith).toHaveLength(2);
});

test('403 (no right) is the app\'s answer - no new sign-in', async () => {
  const a = app([403]);
  expect((await sendSignedIn(a.send, a.token, a.resign)).status).toBe(403);
  expect(a.resigns()).toBe(0);
});
