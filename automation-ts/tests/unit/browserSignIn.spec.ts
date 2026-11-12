import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { endedWords, lookAt, usingLine } from '../../src/signin/browserSignIn';
import { BrowserSignIns, savedSignInName } from '../../src/signin/browserSignInFile';
import { tokenOf } from '../../src/signin/browserToken';

/**
 * Omar 2026-11-10: the Availo Test sign-in asks Google's robot check, so runs reuse a sign-in he made himself in a
 * browser and saved: target/saved-sign-ins/<env>-<login>.json with the whole state. Never a bypass.
 */
const NOW = Date.UTC(2026, 10, 10, 15, 0, 0);
const S = NOW / 1000;
const HOUR = 3_600_000;
const VALUES = ['midnight-theme-value', 'tab-value-x', 'lang-value-x'];

/** a token with this exp (seconds) - built here, never a real one */
function token(exp: number): string {
  const part = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ iat: S - 600, exp })}.sig`;
}

function saved(extra: Record<string, unknown> = {}, tok = token(S + 6 * 3600)): Record<string, unknown> {
  return { savedAt: new Date(NOW - 10 * 60_000).toISOString(), origin: 'https://app.x',
    localStorage: { TOKEN: JSON.stringify(tok), THEME: VALUES[0] }, sessionStorage: { tab: VALUES[1] }, cookies: { lang: VALUES[2] }, ...extra };
}

function look(raw: Record<string, unknown> | undefined, now = NOW): ReturnType<typeof lookAt> {
  return lookAt(raw as never, 'Admin', now);
}

test('a saved sign-in with time left is ready: its whole state kept, its end read from the token', () => {
  const l = look(saved());
  expect(l.kind).toBe('ready');
  if (l.kind !== 'ready') return;
  expect(l.signIn.browser).toEqual({ localStorage: { TOKEN: JSON.stringify(token(S + 6 * 3600)), THEME: VALUES[0] },
    sessionStorage: { tab: VALUES[1] }, cookies: { lang: VALUES[2] } });
  expect(l.signIn.origin).toBe('https://app.x');
  expect(l.signIn.endsAt).toBe((S + 6 * 3600) * 1000);
  expect(l.signIn.savedAt).toBe(NOW - 10 * 60_000);
});

test('expiresAt wins over the token\'s end (a date or epoch ms)', () => {
  const byDate = look(saved({ expiresAt: new Date(NOW + HOUR).toISOString() }));
  expect(byDate.kind === 'ready' && byDate.signIn.endsAt).toBe(NOW + HOUR);
  const byMs = look(saved({ expiresAt: NOW + 2 * HOUR }));
  expect(byMs.kind === 'ready' && byMs.signIn.endsAt).toBe(NOW + 2 * HOUR);
});

test('a saved sign-in past its end is ended, with the plain reason', () => {
  expect(look(saved({}, token(S - 60)))).toEqual({ kind: 'ended', why: endedWords('Admin') });
  expect(look(saved({ expiresAt: NOW - 1 })).kind).toBe('ended');
  expect(endedWords('Admin')).toBe('The saved browser sign-in of Admin has ended - sign in again in the browser and save it');
});

test('boundary: it has ended at its end time exactly, not a millisecond before', () => {
  expect(look(saved({ expiresAt: NOW })).kind).toBe('ended');
  expect(look(saved({ expiresAt: NOW + 1 })).kind).toBe('ready');
});

test('of several tokens the one that ends first counts', () => {
  const l = look(saved({ sessionStorage: { other: token(S + 3600) } }));
  expect(l.kind === 'ready' && l.signIn.endsAt).toBe((S + 3600) * 1000);
});

test('no saved file: none, so the run signs in as before', () => {
  expect(look(undefined)).toEqual({ kind: 'none' });
});

test('the run line says only whose it is, when it was made and when it ends - no value', () => {
  const l = look(saved());
  if (l.kind !== 'ready') throw new Error('not ready');
  const line = usingLine('Admin', l.signIn);
  expect(line).toMatch(/^Using the saved browser sign-in of Admin \(made \d{4}-\d{2}-\d{2} \d{2}:\d{2}, ends \d{4}-\d{2}-\d{2} \d{2}:\d{2}\)$/);
  for (const v of [...VALUES, token(S + 6 * 3600)]) expect(line).not.toContain(v);
});

test('the file is per environment and login, any letter case: <env>-<login>.json', () => {
  expect(savedSignInName('Test', 'Admin')).toBe('test-admin.json');
  expect(savedSignInName(' Stage ', 'Sara Admin')).toBe('stage-sara_admin.json');
});

test('the run reads the file of its environment and login; a broken file is a plain reason that shows none of its text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-browser-'));
  try {
    const files = new BrowserSignIns(() => 'Test', () => dir, () => NOW);
    expect(files.look('Admin')).toEqual({ kind: 'none' });
    fs.writeFileSync(path.join(dir, 'test-admin.json'), JSON.stringify(saved()));
    expect(files.look('admin').kind).toBe('ready');
    expect(new BrowserSignIns(() => 'Stage', () => dir, () => NOW).look('Admin')).toEqual({ kind: 'none' });
    fs.writeFileSync(path.join(dir, 'test-sara.json'), '{"localStorage": {"TOKEN": "SECRET-BROKEN-VALUE');
    const broken = files.look('Sara');
    expect(broken.kind).toBe('ended');
    expect(JSON.stringify(broken)).toContain('The saved browser sign-in of Sara');
    expect(JSON.stringify(broken)).not.toContain('SECRET-BROKEN-VALUE');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const RECIPE = { token: 'token', browser: [{ place: 'localStorage', key: 'TOKEN', from: 'token', as: 'json' }] };
const empty = { localStorage: {}, sessionStorage: {}, cookies: {} };

test('the API takes its token from the recipe\'s token key, without the JSON quotes', () => {
  const tok = token(S + 3600);
  expect(tokenOf({ ...empty, localStorage: { TOKEN: JSON.stringify(tok) } }, RECIPE)).toBe(tok);
  expect(tokenOf({ ...empty, localStorage: { TOKEN: tok } }, RECIPE)).toBe(tok);
});

test('an app with no sign-in recipe: the token found in the saved values', () => {
  const tok = token(S + 3600);
  expect(tokenOf({ ...empty, cookies: { auth: tok } }, undefined)).toBe(tok);
  expect(tokenOf({ ...empty, localStorage: { THEME: 'dark' } }, undefined)).toBe('');
});
