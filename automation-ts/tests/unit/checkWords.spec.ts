import { expect, test } from '@playwright/test';
import { checkEquals, checkTrue } from '../../src/report/checks';
import { compared, happened } from '../../src/report/checkWords';
import { secretValues } from '../../src/report/secretValues';
import { typedValue } from '../../src/report/typedValue';

/**
 * Omar, TS phone run 633: "Home greeting: ok" says nothing. Every check line says what was checked, the expected value,
 * what was seen, then ✓ or ✗ - never a bare "ok". Built by the check helper itself, so every suite gets it.
 */

const hide = (t: string) => t;

test('a compare check says what, expected and seen, then ✓', () => {
  expect(compared('Home greeting', true, '"Welcome, Ali"', '"Welcome, Ali"', hide)).toBe('Home greeting - expected "Welcome, Ali", seen "Welcome, Ali" ✓');
});

test('a failed compare check says expected and seen, then ✗', () => {
  expect(compared('Home greeting', false, '"Welcome, Ali"', '"Welcome"', hide)).toBe('Home greeting - expected "Welcome, Ali", seen "Welcome" ✗');
});

test('a yes / no check says what happened with ✓, or ✗ with the reason', () => {
  expect(happened('The app showed "Password changed successfully"', true, '', hide)).toBe('The app showed "Password changed successfully" ✓');
  expect(happened('After sign-up the attendance screen opened', false, 'the screen did not show within 10 s', hide))
    .toBe('After sign-up the attendance screen opened ✗ - the screen did not show within 10 s');
  expect(happened('Save is enabled', false, '', hide)).toBe('Save is enabled ✗');
});

test('never a bare "ok" in a check line', () => {
  expect(compared('Toast', true, '"Saved"', '"Saved"', hide)).not.toMatch(/\bok\b/);
  expect(happened('Toast shows', true, '', hide)).not.toMatch(/\bok\b/);
});

test('a secret typed in this run shows *** in a check line', () => {
  typedValue('New password', 'css=#pw', 'Zz9!secretX', false, secretValues);
  expect(compared('Password box', true, '"Zz9!secretX"', '"Zz9!secretX"', (t) => secretValues.hide(t))).toBe('Password box - expected "***", seen "***" ✓');
});

test('the check event the run screen gets carries the new words', () => {
  const lines: string[] = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: string) => { lines.push(String(s)); return true; }) as typeof process.stdout.write;
  try {
    checkEquals('Home greeting', 'Welcome, Ali', 'Welcome, Ali');
    checkTrue('The app showed "Password changed successfully"', true);
  } finally {
    process.stdout.write = write;
  }
  const d = lines.map((l) => JSON.parse(l.replace('@@live ', '')).d as string);
  expect(d).toEqual(['Home greeting - expected "Welcome, Ali", seen "Welcome, Ali" \\u2713'.replace('\\u2713', '✓'), 'The app showed "Password changed successfully" ✓']);
});
