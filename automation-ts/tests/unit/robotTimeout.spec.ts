import { EventEmitter } from 'node:events';
import { expect, test } from '@playwright/test';
import { beforeRobotTimeout, PageEvents, robotTimedOut, robotTimeoutWords, watchRobotTimeout } from '../../src/web/signin/robotTimeout';

/** Test 8094 run 622: a screen sign-in that hit "reCAPTCHA Timeout" waited to the 5-minute limit - it stops in seconds. */

test("the robot check's time-out is known in its usual words, nothing else is", () => {
  expect(robotTimedOut('reCAPTCHA Timeout')).toBe(true);
  expect(robotTimedOut('Uncaught (in promise) Timeout (recaptcha)')).toBe(true);
  expect(robotTimedOut('recaptcha timed out')).toBe(true);
  expect(robotTimedOut('Timeout 5000ms exceeded')).toBe(false);
  expect(robotTimedOut('reCAPTCHA loaded')).toBe(false);
});

function fakePage() {
  const e = new EventEmitter();
  return {
    e,
    page: {
      on: (n: string, f: (...x: unknown[]) => void) => { e.on(n, f); },
      off: (n: string, f: (...x: unknown[]) => void) => { e.off(n, f); },
    } as unknown as PageEvents,
  };
}

test('a console line or page error about it ends the sign-in at once with the plain reason - no 5-minute wait', async () => {
  const { e, page } = fakePage();
  const watch = watchRobotTimeout(page, async () => '', 50);
  const abort = new AbortController();
  const never = new Promise<string>(() => undefined);
  const started = Date.now();
  setTimeout(() => e.emit('console', { text: () => 'Uncaught (in promise) reCAPTCHA Timeout' }), 20);
  await expect(beforeRobotTimeout(never, watch, 'stopped', abort)).rejects.toThrow('stopped');
  expect(Date.now() - started).toBeLessThan(2000);
  expect(abort.signal.aborted).toBe(true);
  expect(e.listenerCount('console')).toBe(0); // the watch is gone after
  setTimeout(() => e.emit('pageerror', new Error('reCAPTCHA Timeout')), 0);
  const second = watchRobotTimeout(page, async () => '', 50);
  await expect(beforeRobotTimeout(never, second, 'stopped again', new AbortController())).rejects.toThrow('stopped again');
});

test('the page saying it ends the sign-in too; a sign-in that finishes first is not touched', async () => {
  const said = watchRobotTimeout(fakePage().page, async () => 'reCAPTCHA Timeout', 20);
  await expect(beforeRobotTimeout(new Promise<string>(() => undefined), said, 'stopped', new AbortController())).rejects.toThrow('stopped');
  const quiet = watchRobotTimeout(fakePage().page, async () => '', 20);
  await expect(beforeRobotTimeout(Promise.resolve('in'), quiet, 'stopped', new AbortController())).resolves.toBe('in');
});

test('its reason is plain and never suggests getting around the robot check', () => {
  const w = robotTimeoutWords('Availo', 'Admin');
  expect(w).toContain('Admin');
  expect(w).toContain('robot check');
  expect(w).toContain('never gets around');
});
