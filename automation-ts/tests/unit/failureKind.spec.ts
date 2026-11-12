import { expect, test } from '@playwright/test';
import { kindOf, MissingData, SetUpProblem, SignInProblem } from '../../src/report/failureKind';

/** Round 2 (Omar 2026-11-11): a wrong app result is FAILED; a set-up problem, a sign-in or missing data is BLOCKED. */

test('a check that saw the wrong value is a failure, never a set-up problem - even when its words name the network', () => {
  expect(kindOf('Error: Approve · toast - expected "done", seen "ECONNRESET" ✗').kind).toBe('failed');
  expect(kindOf('Error: Home greeting - expected "Welcome Omar", seen "" ✗').kind).toBe('failed');
  expect(kindOf('TimeoutError: locator.click: Timeout 5000ms exceeded').kind).toBe('failed');
});

test('the network, a lost phone session, Appium down and a crashed test program are set-up problems', () => {
  expect(kindOf('TypeError: fetch failed').kind).toBe('setup');
  expect(kindOf('Error: connect ECONNREFUSED 10.0.0.5:443').kind).toBe('setup');
  expect(kindOf('Error: getaddrinfo ENOTFOUND availo-testingapinew.t2.sa').kind).toBe('setup');
  expect(kindOf('Error: page.goto: net::ERR_INTERNET_DISCONNECTED at https://x/').kind).toBe('setup');
  expect(kindOf('Error: The phone connection closed during the case - the phone may have been used').kind).toBe('setup');
  expect(kindOf('WebDriverError: invalid session id').kind).toBe('setup');
  expect(kindOf('Error: Unable to connect to "http://127.0.0.1:4723/", make sure browser driver is running').kind).toBe('setup');
  expect(kindOf('Error: Worker process exited unexpectedly (code=1, signal=null)').kind).toBe('setup');
});

test("a set-up problem says in plain words what went wrong and that it is not the app's answer, with what was seen", () => {
  const k = kindOf('Error: getaddrinfo ENOTFOUND availo-testingapinew.t2.sa');
  expect(k.reason).toContain('could not be reached');
  expect(k.reason).toContain('not the app');
  expect(k.reason).toContain('ENOTFOUND');
  expect(kindOf('WebDriverError: invalid session id').reason).toContain('phone');
  expect(kindOf('Error: Unable to connect to "http://127.0.0.1:4723/"').reason).toContain('Appium');
});

test("the framework's own kinds keep their reason without the class name in front", () => {
  expect(kindOf(`SetUpProblem: ${new SetUpProblem('The phone is locked').message}`)).toEqual({ kind: 'setup', reason: 'The phone is locked' });
  expect(kindOf('SignInProblem: The saved browser sign-in of Admin has ended'))
    .toEqual({ kind: 'signin', reason: 'The saved browser sign-in of Admin has ended' });
  expect(kindOf('MissingData: Not tested - needs a pending request made by this run').kind).toBe('data');
  expect(kindOf('Error: Not tested - needs the new employee').kind).toBe('data');
  expect(kindOf('SkipLogin: The app refused the saved sign-in of Admin').kind).toBe('signin');
});

test('the kinds are real errors with their own names', () => {
  expect(new SetUpProblem('x').name).toBe('SetUpProblem');
  expect(new SignInProblem('x').name).toBe('SignInProblem');
  expect(new MissingData('x').name).toBe('MissingData');
  expect(new SignInProblem('x')).toBeInstanceOf(Error);
});

test('run 717: the phone dropped off its cable mid-case - Appium could not reach it - is said as the phone, never the app\'s server', () => {
  const r = kindOf('WebDriverError: Could not proxy command to the remote server. Original error: socket hang up when running "source"');
  expect(r.kind).toBe('setup');
  expect(r.reason).toMatch(/^The phone was disconnected during the case/);
  expect(r.reason).not.toMatch(/server could not be reached/);
  expect(kindOf("WebDriverError: Cannot execute the 'pidof' shell command. Original error: Command 'adb.exe -P 5037 -s EE4 shell pidof' exited with code 1").reason)
    .toMatch(/^The phone was disconnected during the case/);
});

test('run 821: the app\'s page did not load in time is not checked (slow), never a failure with the tool\'s words', () => {
  const r = kindOf('TimeoutError: page.goto: Timeout 30000ms exceeded.\nCall log:\n  - navigating to "https://availo-testingnewui.t2.sa/", waiting until "load"');
  expect(r.kind).toBe('slow');
  expect(r.reason).toBe('The app\'s page did not open within 30 s - not the app\'s answer');
  expect(kindOf('TimeoutError: page.reload: Timeout 15000ms exceeded.').reason).toBe('The app\'s page did not open within 15 s - not the app\'s answer');
});
