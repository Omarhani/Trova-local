import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { endedWords } from '../../src/signin/browserSignIn';
import { runSignInBook } from '../../src/signin/runSignInBook';
import { signIn } from '../../src/signin/signIns';
import { SkipLogin } from '../../src/signin/skipLogin';

/**
 * Omar 2026-11-10: the API's own sign-in is refused since the Availo Test sign-in asks Google's robot check (Test 8094
 * runs 619-628). The run's API client takes its token from the sign-in he saved in a browser - no sign-in call.
 */
const KEYS = ['TROVA_RUN_ID', 'TROVA_MODE', 'TROVA_ENV', 'TROVA_SAVED_SIGN_INS_DIR', 'FIA_CREDENTIALS_FILE'] as const;
const before = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const THEME = 'midnight-theme-value';
let dir = '';
let lines: string[] = [];
const log = console.log;

function token(exp: number): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp })}.sig`;
}

const inSec = (s: number): number => Math.trunc(Date.now() / 1000) + s;

function save(login: string, tok: string): void {
  fs.writeFileSync(path.join(dir, `test-${login.toLowerCase()}.json`), JSON.stringify({ savedAt: new Date().toISOString(),
    origin: 'https://app.x', localStorage: { TOKEN: JSON.stringify(tok), THEME }, sessionStorage: {}, cookies: {} }));
}

test.beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-browser-api-'));
  process.env.TROVA_RUN_ID = `unit-browser-${process.pid}-${Date.now()}`;
  process.env.TROVA_ENV = 'Test';
  process.env.TROVA_SAVED_SIGN_INS_DIR = dir;
  process.env.FIA_CREDENTIALS_FILE = path.join(dir, 'no-run-file.json'); // any sign-in call stops: "Run this suite from Trova"
  delete process.env.TROVA_MODE;
  lines = [];
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
});

test.afterEach(() => {
  console.log = log;
  runSignInBook.forget();
  fs.rmSync(dir, { recursive: true, force: true });
  for (const k of KEYS) {
    if (before[k] === undefined) delete process.env[k];
    else process.env[k] = before[k];
  }
});

test('a saved browser sign-in gives the API its token and the whole state, with no sign-in call', async () => {
  const tok = token(inSec(6 * 3600));
  save('BrowserOk', tok);
  const result = await signIn('BrowserOk', 'web');
  expect(result.token).toBe(tok);
  expect(result.browser.localStorage.THEME).toBe(THEME);
  expect(lines.join('\n')).toMatch(/Using the saved browser sign-in of BrowserOk \(made .+, ends .+\)/);
  expect(lines.join('\n')).not.toContain("by Trova's own API calls");
});

test('an ended saved browser sign-in fails with the plain reason; the login\'s later cases are skipped at once', async () => {
  save('BrowserEnded', token(inSec(-60)));
  await expect(signIn('BrowserEnded', 'web')).rejects.toThrow(endedWords('BrowserEnded'));
  const started = Date.now();
  const e = await signIn('BrowserEnded', 'web').catch((x: unknown) => x);
  expect(e).toBeInstanceOf(SkipLogin);
  expect((e as Error).message).toBe(endedWords('BrowserEnded'));
  expect(Date.now() - started).toBeLessThan(1000);
});

test('the app dropped the saved browser sign-in (401): the plain reason, never an API sign-in', async () => {
  save('BrowserDropped', token(inSec(6 * 3600)));
  await signIn('BrowserDropped', 'web');
  await expect(signIn('BrowserDropped', 'web', true)).rejects.toThrow(endedWords('BrowserDropped'));
  expect(runSignInBook.refused('BrowserDropped')).toBe(endedWords('BrowserDropped'));
});

test('no saved file: the API sign-in as before', async () => {
  await expect(signIn('BrowserNone', 'web')).rejects.toThrow('Run this suite from Trova');
});

test('the phone side never takes the browser\'s saved sign-in', async () => {
  save('BrowserPhone', token(inSec(6 * 3600)));
  await expect(signIn('BrowserPhone', 'phone')).rejects.toThrow('Run this suite from Trova');
});

test('no value of the saved browser sign-in reaches a run line or an error', async () => {
  const tok = token(inSec(6 * 3600));
  save('BrowserQuiet', tok);
  await signIn('BrowserQuiet', 'web');
  const err = await signIn('BrowserQuiet', 'web', true).catch((x: unknown) => String(x));
  for (const text of [lines.join('\n'), err]) {
    expect(text).not.toContain(tok);
    expect(text).not.toContain(THEME);
  }
});
