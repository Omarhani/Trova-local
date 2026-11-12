import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { RunSignIns, runSignIns } from '../../src/signin/runSignIns';
import { signIn } from '../../src/signin/signIns';
import { SignInResult } from '../../src/trova/recipeSignIn';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-run-signins-'));
let n = 0;

test.afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function store(now = Date.now()): RunSignIns {
  const file = path.join(dir, `sign-ins-${++n}.json`);
  return new RunSignIns(() => file, () => now);
}

/** a token with these iat / exp (seconds) - built here, never a real one */
function token(iat: number, exp: number): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ iat, exp })}.sig`;
}

function result(tok: string): SignInResult {
  return { token: tok, browser: { localStorage: { USER_ID: '7' }, sessionStorage: {}, cookies: { c: '1' } } };
}

const NOW = Date.UTC(2026, 10, 10, 15, 0, 0);
const S = NOW / 1000;

test('a sign-in kept by one block is given to the next block of the same run, whole', () => {
  const s = store(NOW);
  const r = result(token(S - 60, S + 3600));
  s.keep('web|admin', r);
  expect(s.get('web|admin')).toEqual(r);
});

test('another login or side gets nothing', () => {
  const s = store(NOW);
  s.keep('web|admin', result(token(S, S + 3600)));
  expect(s.get('phone|admin')).toBeUndefined();
  expect(s.get('web|other')).toBeUndefined();
});

test('a sign-in that runs out soon is not given again (the block signs in anew)', () => {
  const s = store(NOW);
  s.keep('web|admin', result(token(S - 3600, S + 60)));
  expect(s.get('web|admin')).toBeUndefined();
});

test('a token with no end time is given again', () => {
  const s = store(NOW);
  s.keep('web|admin', result('opaque-token'));
  expect(s.get('web|admin')?.token).toBe('opaque-token');
});

test('a newer sign-in replaces the one that ran out', () => {
  const s = store(NOW);
  s.keep('web|admin', result(token(S - 60, S + 3600)));
  s.keep('web|admin', result('newer'));
  expect(s.get('web|admin')?.token).toBe('newer');
});

test('forgotten at the run end: nothing left on disk', () => {
  const file = path.join(dir, 'forget.json');
  const s = new RunSignIns(() => file, () => NOW);
  s.keep('web|admin', result('x'));
  expect(fs.existsSync(file)).toBe(true);
  s.forget();
  expect(fs.existsSync(file)).toBe(false);
  expect(s.get('web|admin')).toBeUndefined();
});

test('a broken file is read as nothing kept', () => {
  const file = path.join(dir, 'broken.json');
  fs.writeFileSync(file, '{not json');
  expect(new RunSignIns(() => file, () => NOW).get('web|admin')).toBeUndefined();
});

test('a block in a new worker uses the run\'s sign-in - no new sign-in calls to the app', async () => {
  process.env.TROVA_RUN_ID = `unit-${process.pid}-${Date.now()}`;
  const r = result('kept-by-an-earlier-block');
  runSignIns.keep('web|admin', r);
  try {
    expect(await signIn('Admin', 'web')).toEqual(r);
  } finally {
    runSignIns.forget();
  }
});

test('outside a Trova run nothing is kept on disk', () => {
  const s = new RunSignIns(() => '', () => NOW);
  s.keep('web|admin', result('x'));
  expect(s.get('web|admin')).toBeUndefined();
});
