import { expect, test } from '@playwright/test';
import { phoneSignInOnce } from '../../src/phone/phoneSignInOnce';

/**
 * Item 9 (Test 8094 run 658): the run's one phone sign-in failed ("did not reach its home screen within 90 s") and every
 * later case of that login waited its own ~100 s again. The first failure stands; later cases of the login are BLOCKED at once.
 */

function book() {
  const no = new Map<string, string>();
  return { refused: (l: string) => no.get(l), refuse: (l: string, why: string) => { no.set(l, why); } };
}

test('the first failure ends its case with the reason; every later case of that login is BLOCKED at once - no new wait', async () => {
  const b = book();
  let tries = 0;
  const signIn = async () => { tries++; throw new Error('The phone app did not reach its home screen within 90 s of the sign-in'); };
  await expect(phoneSignInOnce('o.hany+a@t2.sa', signIn, b)).rejects.toThrow('within 90 s');
  const later = await phoneSignInOnce('o.hany+a@t2.sa', signIn, b).catch((e: Error) => e);
  expect(later).toMatchObject({ name: 'SignInProblem' });
  expect(String((later as Error).message)).toContain('failed earlier in this run');
  expect(tries).toBe(1);
});

test('another login still signs in; a passed sign-in is never blocked', async () => {
  const b = book();
  await phoneSignInOnce('a@x', async () => { throw new Error('refused'); }, b).catch(() => undefined);
  await expect(phoneSignInOnce('b@x', async () => undefined, b)).resolves.toBeUndefined();
  await expect(phoneSignInOnce('b@x', async () => undefined, b)).resolves.toBeUndefined();
});

test('a set-up problem (the phone session was lost) is not booked: the case is tried once more and signs in again', async () => {
  const b = book();
  await expect(phoneSignInOnce('c@x', async () => { throw new Error('invalid session id'); }, b)).rejects.toThrow('invalid session id');
  expect(b.refused('phone|c@x')).toBeUndefined();
});
