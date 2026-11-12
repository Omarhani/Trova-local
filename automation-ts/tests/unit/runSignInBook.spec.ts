import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { RunSignInBook, runSignInDir } from '../../src/signin/runSignInBook';
import { SavedSignIn } from '../../src/signin/savedSignIn';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-book-'));
let n = 0;

test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

function book(): { book: RunSignInBook; dir: string } {
  const dir = path.join(root, `run-${++n}`);
  return { book: new RunSignInBook(() => dir), dir };
}

function saved(token: string): SavedSignIn {
  return { origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: token }] }] },
    sessionStorage: { s: '1' }, madeAt: 1, fresh: 0 };
}

test('one saved sign-in per login name, any letter case, read back whole', () => {
  const { book: b } = book();
  b.save('Admin', saved('a'));
  b.save('Sara', saved('s'));
  expect(b.saved('admin')).toEqual(saved('a'));
  expect(b.saved('Sara')).toEqual(saved('s'));
  expect(b.saved('Omar')).toBeUndefined();
});

test('a refusal is kept for the login with its reason, and only for that login', () => {
  const { book: b } = book();
  b.refuse('Admin', 'The app refused the saved sign-in of Admin (its calls answered 401)');
  expect(b.refused('ADMIN')).toContain('its calls answered 401');
  expect(b.refused('Sara')).toBeUndefined();
});

test('forget removes the whole run folder: nothing is left after the run', () => {
  const { book: b, dir } = book();
  b.save('Admin', saved('a'));
  expect(fs.existsSync(dir)).toBe(true);
  b.forget();
  expect(fs.existsSync(dir)).toBe(false);
  expect(b.saved('Admin')).toBeUndefined();
});

test('the run\'s sign-in folder lives in the run\'s own target folder, named by the run', () => {
  const target = path.resolve(__dirname, '..', '..', 'target');
  expect(runSignInDir({ TROVA_RUN_ID: '624' } as NodeJS.ProcessEnv)).toBe(path.join(target, 'run-sign-ins-624'));
  expect(runSignInDir({ TROVA_RUN_ID: '../x' } as NodeJS.ProcessEnv)).toBe(path.join(target, 'run-sign-ins-___x'));
});

test('a login name never becomes a path outside the run folder', () => {
  const { book: b, dir } = book();
  b.save('../../evil', saved('a'));
  expect(fs.readdirSync(dir).every((f) => !f.includes('/') && !f.includes('..'))).toBe(true);
  expect(b.saved('../../evil')).toEqual(saved('a'));
});
