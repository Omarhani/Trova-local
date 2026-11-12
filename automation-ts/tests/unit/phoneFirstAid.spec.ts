import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { PhoneActions } from '../../src/phone/phoneActions';
import { PhoneAid, PhoneHelpAsk, PhoneStuck } from '../../src/phone/phoneHelpAsk';
import { announcePhone, announcedPhone } from '../../src/phone/phoneAnnounce';
import { Phone } from '../../src/phone/phoneSession';
import { RunnerHelp } from '../../src/run/aiHelp/runnerHelp';
import { HelpAnswer } from '../../src/run/aiHelp/helpAnswer';
import { kindOf, SetUpProblem } from '../../src/report/failureKind';

/** Self-healing on the phone (Omar 2026-11-11): a phone step whose element does not show asks Trova's AI help like a web step. */

const LOGIN = '//*[@resource-id="login"]';
const BUTTON = '<hierarchy><android.widget.Button resource-id="com.x:id/login" bounds="[0,0][100,50]"/></hierarchy>';
const EMPTY = '<hierarchy></hierarchy>';

class LoginScreen extends PhoneActions {
  signIn(): Promise<void> {
    return this.tap(LOGIN, 0, 'Login button');
  }
}

/** a phone that shows these screens one look after the other (the last one stays) and keeps its shell commands */
function phoneShowing(...screens: string[]) {
  let look = 0;
  const shells: string[][] = [];
  const phone = {
    getPageSource: async () => screens[Math.min(look++, screens.length - 1)],
    execute: async (_c: string, a: { command: string; args: string[] }) => { shells.push([a.command, ...a.args]); return ''; },
    pause: async () => undefined,
    takeScreenshot: async () => '',
  } as unknown as Phone;
  return { phone, shells };
}

function aid(answer: HelpAnswer | null, seen: PhoneStuck[] = []): PhoneAid {
  return async (where) => { seen.push(where); return answer; };
}

test('a phone step whose element does not show asks AI help with its screen and step, then taps once it shows', async () => {
  const { phone, shells } = phoneShowing(EMPTY, BUTTON);
  const seen: PhoneStuck[] = [];
  await new LoginScreen(phone, aid({ helped: true, did: 'closed a notice', cause: 'OUR_CODE', proof: 'a notice covered it' }, seen)).signIn();
  expect(seen[0]).toMatchObject({ screen: 'LoginScreen', step: 'LoginScreen.signIn', element: 'Login button', action: 'click' });
  expect(shells).toContainEqual(['input', 'tap', '50', '25']);
});

test('no AI help in the run: the phone step fails as it always did', async () => {
  const { phone } = phoneShowing(EMPTY);
  await expect(new LoginScreen(phone, aid(null)).signIn()).rejects.toThrow("Login button did not show within 0 s");
});

test('an element that shows in time never asks AI help', async () => {
  const { phone } = phoneShowing(BUTTON);
  const seen: PhoneStuck[] = [];
  await new LoginScreen(phone, aid(null, seen)).signIn();
  expect(seen).toEqual([]);
});

test('the app is wrong (APP): the step FAILS as Expected / Actual with what the AI saw', async () => {
  const { phone } = phoneShowing(EMPTY);
  const failed = new LoginScreen(phone, aid({ helped: false, did: '', cause: 'APP', proof: 'the app shows "Server error"' })).signIn();
  await expect(failed).rejects.toThrow('Expected: this step goes on / Actual: the app shows "Server error"');
});

test('the network or the phone let it down (ENVIRONMENT): the step is BLOCKED, never the app\'s fault', async () => {
  const { phone } = phoneShowing(EMPTY);
  const e = await new LoginScreen(phone, aid({ helped: false, did: '', cause: 'ENVIRONMENT', proof: 'no connection' })).signIn().catch((x) => x);
  expect(e).toBeInstanceOf(SetUpProblem);
  expect(kindOf(String(e)).kind).toBe('setup');
  expect(e.message).toContain('The test could not finish'); // Omar 2026-11-12 (run 985): never "Not checked"
  expect(e.message).toContain('no connection');
});

test('helped but our step still cannot find its element (OUR_CODE): BLOCKED - our test step needs a look', async () => {
  const { phone } = phoneShowing(EMPTY);
  const e = await new LoginScreen(phone, aid({ helped: true, did: 'opened the menu', cause: 'OUR_CODE', proof: 'the button was renamed' })).signIn().catch((x) => x);
  expect(e).toBeInstanceOf(SetUpProblem);
  expect(e.message).toBe('The test needs an update - the app looks fine: the button was renamed');
});

test('helped with an unclear cause and still not there: still stuck, in plain words', async () => {
  const { phone } = phoneShowing(EMPTY);
  await expect(new LoginScreen(phone, aid({ helped: true, did: 'waited', cause: 'UNKNOWN' })).signIn())
    .rejects.toThrow("Still stuck after AI help (waited) - Login button did not show within 0 s");
});

function folder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trova-phone-aid-'));
}

const STUCK: PhoneStuck = { screen: 'LoginScreen', step: 'LoginScreen.signIn', element: 'Login button', action: 'click', test: 'sign in' };

test('the phone ask goes to the runner as one "ai-help" line marked phone, and the answer file is read and removed', async () => {
  const dir = folder();
  const lines: Record<string, unknown>[] = [];
  const help = new RunnerHelp(dir, 2_000, 20, (t, f) => {
    lines.push({ t, ...f });
    if (t === 'ai-help') fs.writeFileSync(path.join(dir, `ai-help-${f.n}.json`), JSON.stringify({ ok: true, did: 'closed a notice', cause: 'OUR_CODE', proof: 'p' }));
  });
  const a = await new PhoneHelpAsk(help, () => 'S1').ask(STUCK, new Error('"x" did not show within 5 s'));
  expect(a).toMatchObject({ helped: true, did: 'closed a notice', cause: 'OUR_CODE' });
  expect(lines[0]).toMatchObject({ t: 'ai-help', phone: true, screen: 'LoginScreen', step: 'LoginScreen.signIn', element: 'Login button', test: 'sign in', problem: '"x" did not show within 5 s' });
  expect(fs.readdirSync(dir)).toEqual([]);
});

test('no phone session announced, or no live folder: nothing is asked', async () => {
  let asked = 0;
  const say = () => { asked++; };
  expect(await new PhoneHelpAsk(new RunnerHelp(folder(), 100, 20, say), () => undefined).ask(STUCK, new Error('x'))).toBeNull();
  expect(await new PhoneHelpAsk(new RunnerHelp(undefined, 100, 20, say), () => 'S1').ask(STUCK, new Error('x'))).toBeNull();
  expect(asked).toBe(0);
});

test('the block announces its phone session (address and session) for the runner\'s AI, like the web\'s "cdp"', () => {
  const lines: Record<string, unknown>[] = [];
  const phone = { sessionId: 'S1', capabilities: { 'appium:udid': 'R58N' } } as unknown as Phone;
  announcePhone(phone, { TROVA_APPIUM_URL: 'http://127.0.0.1:4799' }, (t, f) => lines.push({ t, ...f }));
  expect(lines).toEqual([{ t: 'appium', addr: 'http://127.0.0.1:4799/', session: 'S1', udid: 'R58N' }]);
  expect(announcedPhone()).toBe('S1');
});
