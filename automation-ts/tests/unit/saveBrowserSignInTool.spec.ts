import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BrowserSignIns } from '../../src/signin/browserSignInFile';

/** Omar 2026-11-10: the tester saves a sign-in he made in a browser; the tool prints only its keys and its end. */
const TOOL = path.resolve(__dirname, '..', '..', 'tools', 'save-browser-sign-in.js');
const VALUES = ['midnight-theme-value', 'tab-value-x', 'lang-value-x'];
let dir = '';

function token(exp: number): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ exp })}.sig`;
}

function run(args: string[], input: string): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [TOOL, ...args], { input, encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, TROVA_SAVED_SIGN_INS_DIR: dir } });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test.beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-save-tool-'));
});

test.afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the tool saves the whole state for the environment and login, printing only its keys and its end', () => {
  const tok = token(Math.trunc(Date.now() / 1000) + 6 * 3600);
  const r = run(['Test', 'Admin'], JSON.stringify({ origin: 'https://app.x',
    localStorage: { TOKEN: JSON.stringify(tok), THEME: VALUES[0] }, sessionStorage: { tab: VALUES[1] }, cookies: { lang: VALUES[2] } }));
  expect(r.status).toBe(0);
  for (const v of [tok, ...VALUES]) expect(r.out).not.toContain(v);
  for (const k of ['TOKEN', 'THEME', 'tab', 'lang']) expect(r.out).toContain(k);
  expect(r.out).toMatch(/ends \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  const file = path.join(dir, 'test-admin.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, string>>;
  expect(saved.localStorage.THEME).toBe(VALUES[0]);
  expect(saved.origin).toBe('https://app.x');
  expect(Number.isNaN(Date.parse(String(saved.savedAt)))).toBe(false);
  if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  expect(new BrowserSignIns(() => 'Test', () => dir).look('Admin').kind).toBe('ready'); // the run reads what the tool wrote
});

test('the tool refuses a text that is not a browser state, never echoing it, and writes nothing', () => {
  const r = run(['Test', 'Admin'], 'SECRET-NOT-JSON-VALUE {');
  expect(r.status).not.toBe(0);
  expect(r.out).not.toContain('SECRET-NOT-JSON-VALUE');
  expect(fs.existsSync(path.join(dir, 'test-admin.json'))).toBe(false);
});

test('the tool without the environment and login says how to use it, and writes nothing', () => {
  const r = run([], '{}');
  expect(r.status).not.toBe(0);
  expect(r.out).toContain('save-browser-sign-in.js <environment> <login>');
  expect(fs.readdirSync(dir)).toEqual([]);
});
