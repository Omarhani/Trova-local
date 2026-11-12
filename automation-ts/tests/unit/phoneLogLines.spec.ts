import { expect, test } from '@playwright/test';
import { AppLine, parseLogcat } from '../../src/phone/logcatLine';
import { problemOf } from '../../src/phone/phoneProblems';

const APP = new Set([4321]);
const PKG = 'com.example.shop';
const line = (pid: number, level: string, tag: string, text: string): AppLine => ({ at: 1, pid, tid: pid, level, tag, text });

test('a phone log line (threadtime) gives its process, thread, level, tag and text', () => {
  expect(parseLogcat('11-10 12:34:56.789  4321  4350 E flutter : Unhandled Exception: boom', 7))
    .toEqual({ at: 7, time: '11-10 12:34:56.789', pid: 4321, tid: 4350, level: 'E', tag: 'flutter', text: 'Unhandled Exception: boom' });
  expect(parseLogcat('11-10 12:34:56.789  4321  4321 W System.err: java.io.IOException: x', 7)?.tag).toBe('System.err');
});

test('the short log form "E/tag( pid): text" is read too; anything else is not a log line', () => {
  expect(parseLogcat('E/okhttp( 4321): <-- HTTP FAILED: timeout', 3)).toEqual({ at: 3, pid: 4321, tid: 4321, level: 'E', tag: 'okhttp', text: '<-- HTTP FAILED: timeout' });
  expect(parseLogcat('--------- beginning of main', 3)).toBeUndefined();
  expect(parseLogcat('', 3)).toBeUndefined();
});

test("the app's own warning and error lines are problems with their level", () => {
  expect(problemOf(line(4321, 'W', 'flutter', 'slow answer'), APP, PKG)).toEqual({ level: 'warning', text: 'flutter: slow answer' });
  expect(problemOf(line(4321, 'E', 'MyApi', 'could not save'), APP, PKG)).toEqual({ level: 'error', text: 'MyApi: could not save' });
  expect(problemOf(line(4321, 'F', 'libc', 'Fatal signal 11'), APP, PKG)?.level).toBe('error');
});

test("other apps' lines and the app's info / debug lines are left out", () => {
  expect(problemOf(line(999, 'E', 'Gmail', 'sync failed'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'I', 'flutter', 'opened home'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'D', 'flutter', 'tap'), APP, PKG)).toBeUndefined();
});

test("the phone system's own noise inside the app is left out (drawing, frames, keyboard, hidden-API notes)", () => {
  expect(problemOf(line(4321, 'W', 'OpenGLRenderer', 'Failed to choose config'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'I', 'Choreographer', 'Skipped 40 frames!'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'W', 'IInputConnectionWrapper', 'getTextBeforeCursor on inactive'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'W', 'mple.shop', 'Accessing hidden method Landroid/view/View;'), APP, PKG)).toBeUndefined();
});

test('the app stopping is said in plain words; not responding is said even from the system', () => {
  expect(problemOf(line(4321, 'E', 'AndroidRuntime', 'FATAL EXCEPTION: main'), APP, PKG))
    .toEqual({ level: 'error', text: 'The app stopped: FATAL EXCEPTION: main' });
  expect(problemOf(line(1000, 'E', 'ActivityManager', `ANR in ${PKG} (${PKG}/.Main)`), APP, PKG))
    .toEqual({ level: 'error', text: `The app did not respond: ANR in ${PKG} (${PKG}/.Main)` });
  expect(problemOf(line(1000, 'E', 'ActivityManager', 'ANR in com.other.app'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(999, 'E', 'AndroidRuntime', 'FATAL EXCEPTION: main'), APP, PKG)).toBeUndefined();
});

test('a problem line is masked and kept to 1000 characters on one line', () => {
  expect(problemOf(line(4321, 'E', 'Api', 'refused Authorization: Bearer abc'), APP, PKG)?.text).toBe('Api: refused Authorization: ***');
  const long = problemOf(line(4321, 'E', 'Api', 'x'.repeat(1500)), APP, PKG)?.text ?? '';
  expect(long.length).toBe(1003);
  expect(long.endsWith('...')).toBe(true);
});

test("the phone's security audit lines (SELinux avc) inside the app are left out, any app (Test 8094 run 610)", () => {
  expect(problemOf(line(4321, 'W', 'FinalizerDaemon', 'type=1400 audit(0.0:64205): avc: denied { getopt } for scontext=u:r:untrusted_app:s0'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'E', 'auditd', 'avc: denied { read } for name="stat"'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'W', 'main', 'type=1400 audit(1731240000.123:77): avc: granted { execute }'), APP, PKG)).toBeUndefined();
  expect(problemOf(line(4321, 'E', 'MyApi', 'the audit of the order failed'), APP, PKG)).toEqual({ level: 'error', text: 'MyApi: the audit of the order failed' });
});
