import { expect, test } from '@playwright/test';
import { RunMode } from '../../src/run/runMode';
import { BrowserLook, endedWords } from '../../src/signin/browserSignIn';
import { SavedSignIn } from '../../src/signin/savedSignIn';
import { GateDeps, SignInGate } from '../../src/signin/signInGate';
import { SkipLogin } from '../../src/signin/skipLogin';

/**
 * Omar: ONE sign-in per run. Test 8094 run 624 (suite 56): case 2 reused the run's sign-in, the app refused it (401),
 * then the case signed in again by API and tried the sign-in page; case 3 did the whole loop again.
 */
const SECRET = 'SECRET-TOKEN-VALUE';
const HOUR = 3_600_000;

class Fakes {
  saved = new Map<string, SavedSignIn>();
  refusals = new Map<string, string>();
  held = '';
  api: { login: string; fresh: boolean }[] = [];
  screen: string[] = [];
  puts: string[] = [];
  proves = 0;
  said: string[] = [];
  /** what the app says when opened: null = signed in, else why not */
  answer: string | null = null;
  apiAnswer: string | null | Error = null;
  /** the sign-in the tester saved in a real browser, per login (none when not set) */
  browserLooks = new Map<string, BrowserLook>();
  browserPuts: string[] = [];
  ends = new Map<string, number>(); // login -> ms left of the saved sign-in
  now = 10 * HOUR;

  deps(mode: RunMode = 'hybrid'): GateDeps {
    return {
      mode,
      book: {
        saved: (l) => this.saved.get(l),
        save: (l, s) => { this.saved.set(l, s); },
        refused: (l) => this.refusals.get(l),
        refuse: (l, why) => { this.refusals.set(l, why); },
      },
      held: () => this.held,
      hold: (l) => { this.held = l; },
      byApi: async (login, fresh) => {
        this.api.push({ login, fresh });
        if (this.apiAnswer instanceof Error) throw this.apiAnswer;
        return this.apiAnswer;
      },
      byScreen: async (login) => { this.screen.push(login); return this.answer; },
      browser: (login) => this.browserLooks.get(login) ?? { kind: 'none' },
      putBrowser: async (s) => { this.browserPuts.push(s.origin); },
      capture: async () => ({ origin: 'https://app.x', storage: { cookies: [], origins: [{ origin: 'https://app.x', localStorage: [{ name: 'TOKEN', value: SECRET }] }] }, sessionStorage: {} }),
      put: async (s) => { this.puts.push(s.origin); },
      prove: async () => { this.proves += 1; return this.answer; },
      renewDue: (s) => {
        const left = this.ends.get(this.loginOf(s)) ?? HOUR;
        return left < 5 * 60_000 ? `in ${Math.trunc(left / 60_000)} min` : null;
      },
      now: () => this.now,
      say: (l) => { this.said.push(l); },
    };
  }

  private loginOf(s: SavedSignIn): string {
    return [...this.saved.entries()].find(([, v]) => v === s)?.[0] ?? '';
  }
}

test('(a) cases 2+ make no sign-in calls: one sign-in on first use, the saved one after', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  await gate.open('Admin');
  await gate.open('Admin');
  expect(f.api).toEqual([{ login: 'Admin', fresh: false }]);
  expect(f.screen).toEqual([]);
  expect(f.puts).toEqual([]); // the tab holds Admin already: nothing put in again
  expect(f.proves).toBe(2); // every later case proves it is signed in before its steps
});

test('(b) a refused saved sign-in fails that case with the plain reason and skips the rest of its login in under 1 s', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  f.answer = 'its calls answered 401';
  await expect(gate.open('Admin')).rejects.toThrow(
    "The app refused Trova's sign-in of Admin - expected: the app signed in as Admin, seen: its calls answered 401 - check the app's sign-in on the server");
  const started = Date.now();
  for (let i = 0; i < 3; i++) {
    const e = await gate.open('Admin').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SkipLogin);
    expect((e as Error).message).toContain("The app refused Trova's sign-in of Admin");
  }
  expect(Date.now() - started).toBeLessThan(1000);
  expect(f.api).toHaveLength(1); // no second sign-in
  expect(f.proves).toBe(1); // the skipped cases never touch the app
});

test('(c) hybrid never goes to the sign-in page: not on a refusal, not on a refused sign-in by API, not in the middle of a case', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps('hybrid'));
  f.apiAnswer = new Error('Availo refused: you don\'t have permission to sign in');
  await expect(gate.open('Admin')).rejects.toThrow('Availo refused');
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
  f.apiAnswer = null;
  await gate.open('Sara');
  f.answer = 'it went to its sign-in page';
  await expect(gate.open('Sara')).rejects.toThrow("The app refused Trova's sign-in of Sara"); // run 679: no saved browser file was used
  await expect(gate.again('Sara')).rejects.toBeInstanceOf(SkipLogin);
  expect(f.screen).toEqual([]);
});

test('(d) a sign-in that runs out soon gets ONE fresh sign-in, saved for the rest of the run', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  f.ends.set('Admin', 3 * 60_000);
  await gate.open('Admin');
  f.ends.set('Admin', HOUR); // the fresh one lives an hour
  await gate.open('Admin');
  await gate.open('Admin');
  expect(f.api).toEqual([{ login: 'Admin', fresh: false }, { login: 'Admin', fresh: true }]);
  expect(f.saved.get('Admin')?.fresh).toBe(1);
  expect(f.said.some((l) => l.includes('runs out in 3 min'))).toBe(true);
});

test('the API sign-in fails because the app\'s calls changed: that case fails with the reason, the rest are skipped, no screen', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  f.apiAnswer = new Error("The app's sign-in calls changed - learn again (User/Login gave HTTP 404)");
  await expect(gate.open('Admin')).rejects.toThrow("The app's sign-in calls changed - learn again");
  await expect(gate.open('Admin')).rejects.toThrow("The app's sign-in calls changed - learn again");
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
  expect(f.api).toHaveLength(1);
  expect(f.screen).toEqual([]);
});

test('the run\'s API sign-in (made by case 1) refused when the first web case opens: the plain reason, then skips', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  f.apiAnswer = 'its calls answered 401';
  await expect(gate.open('Admin')).rejects.toThrow(
    "The app refused Trova's sign-in of Admin - expected: the app signed in as Admin, seen: its calls answered 401 - check the app's sign-in on the server");
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
});

test('each login has its own saved sign-in, made once on first use', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  await gate.open('Sara');
  await gate.open('Admin');
  await gate.open('Sara');
  expect(f.api.map((a) => a.login)).toEqual(['Admin', 'Sara']);
  expect(f.puts).toEqual(['https://app.x', 'https://app.x']); // the other login's saved state put in, never a sign-in
});

test('a sign-out in the middle of a case: one fresh API sign-in, saved again', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  await gate.again('Admin');
  expect(f.api).toEqual([{ login: 'Admin', fresh: false }, { login: 'Admin', fresh: true }]);
  expect(f.saved.get('Admin')?.fresh).toBe(1);
});

test('full screen mode: the sign-in page once per run, never the API, and its state reused', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps('ui'));
  await gate.open('Admin');
  await gate.open('Admin');
  f.ends.set('Admin', 60_000);
  await gate.open('Admin');
  expect(f.screen).toEqual(['Admin']);
  expect(f.api).toEqual([]);
});

test('full screen mode: a sign-out in the middle of a case fails it with the reason, no second sign-in page', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps('ui'));
  await gate.open('Admin');
  await expect(gate.again('Admin')).rejects.toThrow('signs in once per run');
  expect(f.screen).toEqual(['Admin']);
});

test('the saved sign-in\'s values never reach a run log line', async () => {
  const f = new Fakes();
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  await gate.open('Admin');
  f.answer = 'its calls answered 401';
  await gate.open('Admin').catch(() => undefined);
  expect(f.said.length).toBeGreaterThan(0);
  expect(f.said.join('\n')).not.toContain(SECRET);
  expect([...f.refusals.values()].join('\n')).not.toContain(SECRET);
});

/**
 * Omar 2026-11-10: the Availo Test sign-in asks Google's robot check, so the API's own sign-in is refused (Test 8094
 * runs 619-628). Runs reuse a sign-in he made himself in a browser and saved (about 6 h) - never a bypass.
 */
const BROWSER_SECRET = 'BROWSER-SAVED-TOKEN-VALUE';

function browserReady(f: Fakes, endsIn = 6 * HOUR): BrowserLook {
  return { kind: 'ready', signIn: { origin: 'https://saved.app.x', savedAt: f.now - 10 * 60_000, endsAt: f.now + endsIn,
    browser: { localStorage: { TOKEN: JSON.stringify(BROWSER_SECRET) }, sessionStorage: { s: BROWSER_SECRET }, cookies: { c: BROWSER_SECRET } } } };
}

test('a saved browser sign-in is put in instead of any sign-in: no sign-in call, proved, reused by later cases', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f));
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  await gate.open('Admin');
  await gate.open('Admin');
  expect(f.api).toEqual([]);
  expect(f.screen).toEqual([]);
  expect(f.browserPuts).toEqual(['https://saved.app.x']); // put in once; later cases reuse the run's saved state
  expect(f.proves).toBe(3); // every case proves it is signed in before any step counts
  expect(f.said[0]).toMatch(/^Using the saved browser sign-in of Admin \(made .+, ends .+\)$/);
});

test('full screen mode uses the saved browser sign-in too - never the sign-in page', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f));
  await new SignInGate(f.deps('ui')).open('Admin');
  expect(f.screen).toEqual([]);
  expect(f.browserPuts).toHaveLength(1);
});

test('an ended saved browser sign-in fails the first case with the plain reason and skips the rest fast - no API, no screen', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', { kind: 'ended', why: endedWords('Admin') });
  const gate = new SignInGate(f.deps());
  await expect(gate.open('Admin')).rejects.toThrow(
    'The saved browser sign-in of Admin has ended - sign in again in the browser and save it');
  const started = Date.now();
  for (let i = 0; i < 3; i++) {
    const e = await gate.open('Admin').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SkipLogin);
    expect((e as Error).message).toBe(endedWords('Admin'));
  }
  expect(Date.now() - started).toBeLessThan(1000);
  expect(f.api).toEqual([]);
  expect(f.screen).toEqual([]);
  expect(f.browserPuts).toEqual([]);
  expect(f.proves).toBe(0);
});

test('the app refuses the saved browser sign-in: the same plain reason, then skips - no API sign-in', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f));
  f.answer = 'its calls answered 401';
  const gate = new SignInGate(f.deps());
  await expect(gate.open('Admin')).rejects.toThrow(endedWords('Admin'));
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
  expect(f.api).toEqual([]);
  expect(f.screen).toEqual([]);
});

test('a later case after the saved browser sign-in ran out: the plain reason, never a fresh sign-in', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f, 10 * 60_000));
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  f.now += 10 * 60_000; // boundary: its end time exactly
  f.ends.set('Admin', 0);
  await expect(gate.open('Admin')).rejects.toThrow(endedWords('Admin'));
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
  expect(f.api).toEqual([]);
  expect(f.proves).toBe(1);
});

test('a saved browser sign-in is never renewed by API, and a sign-out mid-case ends it in plain words', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f));
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  f.ends.set('Admin', 3 * 60_000); // an API sign-in would be renewed now
  await gate.open('Admin');
  expect(f.api).toEqual([]);
  await expect(gate.again('Admin')).rejects.toThrow(endedWords('Admin'));
  await expect(gate.open('Admin')).rejects.toBeInstanceOf(SkipLogin);
  expect(f.api).toEqual([]);
});

test('no saved browser sign-in: the API sign-in as before', async () => {
  const f = new Fakes();
  await new SignInGate(f.deps()).open('Admin');
  expect(f.api).toEqual([{ login: 'Admin', fresh: false }]);
  expect(f.browserPuts).toEqual([]);
});

test('the saved browser sign-in\'s values never reach a run line or a reason', async () => {
  const f = new Fakes();
  f.browserLooks.set('Admin', browserReady(f));
  f.browserLooks.set('Sara', browserReady(f));
  const gate = new SignInGate(f.deps());
  await gate.open('Admin');
  f.answer = 'its calls answered 401';
  await gate.open('Sara').catch(() => undefined);
  expect(f.said.join('\n')).not.toContain(BROWSER_SECRET);
  expect([...f.refusals.values()].join('\n')).not.toContain(BROWSER_SECRET);
});

test('Round 2 review: a network break during the run\'s one sign-in is a set-up problem - the login is NOT refused for the run', async () => {
  const f = new Fakes();
  f.apiAnswer = new TypeError('fetch failed');
  const gate = new SignInGate(f.deps());
  const err = await gate.open('Admin').catch((e: Error) => e);
  expect(err).toMatchObject({ name: 'SetUpProblem' });
  expect(f.refusals.get('Admin')).toBeUndefined(); // the second try signs in again
});

test('run 687: the first web case finds the sign-in page - BLOCKED with expected / seen in plain words', async () => {
  const f = new Fakes();
  f.apiAnswer = 'it went to its sign-in page'; // the run's sign-in put into the browser, the app showed its sign-in page
  const gate = new SignInGate(f.deps());
  const err = await gate.open('Admin').catch((e: Error) => e);
  expect(err).toMatchObject({ name: 'SignInProblem' });
  expect(String((err as Error).message)).toContain('expected: the app signed in as Admin, seen: the sign-in page');
});

test('run 864: the app\'s page too slow during the run\'s one sign-in - Not checked in plain words, the login NOT refused', async () => {
  const f = new Fakes();
  const slow = new Error('page.goto: Timeout 30000ms exceeded.\nCall log:\n  - navigating to "https://app.x/", waiting until "domcontentloaded"');
  slow.name = 'TimeoutError';
  f.apiAnswer = slow;
  const gate = new SignInGate(f.deps());
  const err = await gate.open('Admin').catch((e: Error) => e);
  expect(err).toMatchObject({ name: 'SlowAnswer', message: 'The app\'s page did not open within 30 s - not the app\'s answer' });
  expect(f.refusals.get('Admin')).toBeUndefined(); // a slow page is not a refusal: the next case signs in again
});
