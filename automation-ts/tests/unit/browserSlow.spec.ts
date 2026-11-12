import { expect, test } from '@playwright/test';
import { isSlow, retryOnce, SLOW } from '../../src/web/browserSlow';

test('a page load or renderer timeout is a slow browser; a missing element or a refusal is not', () => {
  expect(isSlow(new Error('page.goto: Timeout 30000ms exceeded.'))).toBe(true);
  expect(isSlow(new Error('Navigation timeout of 30000 ms exceeded'))).toBe(true);
  expect(isSlow(new Error('x', { cause: new Error('timeout: Timed out receiving message from renderer') }))).toBe(true);
  expect(isSlow(new Error('locator.click: Timeout 10000ms exceeded.'))).toBe(false);
  expect(isSlow(new Error('Sign-in refused'))).toBe(false);
  expect(isSlow(undefined)).toBe(false);
});

test('a slow step is said and tried once more', async () => {
  const said: string[] = [];
  let tries = 0;
  const value = await retryOnce(async () => {
    tries += 1;
    if (tries === 1) throw new Error('page.goto: Timeout 10000ms exceeded.');
    return 'opened';
  }, (line) => said.push(line));
  expect([value, tries, said]).toEqual(['opened', 2, [`${SLOW} - retried once`]]);
});

test('slow twice = a plain slow reason, never a refusal', async () => {
  await expect(retryOnce(async () => { throw new Error('page.goto: Timeout 10000ms exceeded.'); }, () => undefined))
    .rejects.toThrow('The browser was slow - retried once, it was still slow');
});

test('any other failure is not tried again', async () => {
  let tries = 0;
  await expect(retryOnce(async () => { tries += 1; throw new Error('Sign-in refused'); }, () => undefined)).rejects.toThrow('Sign-in refused');
  expect(tries).toBe(1);
});
