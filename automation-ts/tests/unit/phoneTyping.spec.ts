import { expect, test } from '@playwright/test';
import { pieces, plain, shellText, typeText, UNICODE_IME } from '../../src/core/phoneTyping';

/** Test 8094 run 585: the account code set as a value never reached the Flutter app (field empty, Next grey) - typed as keys now, the AI-run way. */
test('plain Latin without % is typed with input text, spaces as %s, shell signs escaped', () => {
  expect(plain('o.hany@t2.sa')).toBe(true);
  expect(plain('50%')).toBe(false);
  expect(plain('تجربة')).toBe(false);
  expect(shellText('a b&c')).toBe('a%sb\\&c');
});

test('pieces never cut a %s in two', () => {
  expect(pieces('ab%s')).toEqual(['ab%', 's']);
});

test('plain text goes in one input text, nothing switched', async () => {
  const calls: string[][] = [];
  await typeText(async (...a) => { calls.push(a); return ''; }, 'AutoTest');
  expect(calls).toEqual([['input', 'text', 'AutoTest']]);
});

test('other text switches to the Unicode keyboard and puts the own keyboard back', async () => {
  const calls: string[][] = [];
  let ime = 'com.google/.Latin';
  const shell = async (...a: string[]): Promise<string> => {
    calls.push(a);
    if (a[0] === 'settings') return ime;
    if (a[0] === 'ime' && a[1] === 'set') ime = a[2];
    return '';
  };
  await typeText(shell, 'تم', { wait: async () => {} });
  expect(calls.some((c) => c[0] === 'ime' && c[2] === UNICODE_IME)).toBe(true);
  expect(ime).toBe('com.google/.Latin');
});

test('trap: a phone that says something back did not take the text', async () => {
  await expect(typeText(async () => 'Error: no focus', 'x')).rejects.toThrow('The phone did not take the text');
});
