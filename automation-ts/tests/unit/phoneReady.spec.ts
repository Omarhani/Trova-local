import { expect, test } from '@playwright/test';
import { lockedIn, lockFileSays, otherSessionOn, phoneStateIn } from '../../src/run/phoneReady';

/** Round 2 pre-run check: the phone connected, unlocked and free - read from adb and Appium's own answers. */

const ADB = 'List of devices attached\nEE4PORJ7S86TYHFU\tdevice\nemulator-5554\toffline\nR58\tunauthorized\n';

test('adb says whether the run\'s phone is there and ready', () => {
  expect(phoneStateIn(ADB, 'EE4PORJ7S86TYHFU')).toBeNull();
  expect(phoneStateIn(ADB, 'NOPE')).toContain('not connected');
  expect(phoneStateIn(ADB, 'R58')).toContain('allow USB debugging');
  expect(phoneStateIn(ADB, 'emulator-5554')).toContain('not connected');
  expect(phoneStateIn(ADB, '')).toBeNull(); // no phone picked: any ready one
  expect(phoneStateIn('List of devices attached\n', '')).toContain('No phone');
});

test('the lock screen is read from the window list', () => {
  expect(lockedIn('  mDreamingLockscreen=true mDreaming=false\n')).toBe(true);
  expect(lockedIn('mShowingLockscreen=true')).toBe(true);
  expect(lockedIn('isKeyguardShowing=true')).toBe(true);
  expect(lockedIn('mDreamingLockscreen=false mShowingLockscreen=false')).toBe(false);
});

test('another test session on the phone makes it busy; the run\'s own kept one does not', () => {
  const sessions = { value: [{ id: 's1', capabilities: { udid: 'EE4PORJ7S86TYHFU' } }] };
  expect(otherSessionOn(sessions, 'EE4PORJ7S86TYHFU', undefined)).toBe(true);
  expect(otherSessionOn(sessions, 'EE4PORJ7S86TYHFU', 's1')).toBe(false);
  expect(otherSessionOn(sessions, 'OTHER', undefined)).toBe(false);
  expect(otherSessionOn({ value: [] }, '', undefined)).toBe(false);
  expect(otherSessionOn({ value: [{ id: 's2', capabilities: {} }] }, '', undefined)).toBe(true);
});

test('a lock file named in the settings: busy unless it is this run\'s owner\'s', () => {
  expect(lockFileSays(undefined, '')).toBeNull();
  expect(lockFileSays('r2-ai builder\n', '')).toContain('r2-ai builder');
  expect(lockFileSays('r2-auto builder', 'r2-auto builder')).toBeNull();
});

test('during the run: a phone held by something else is waited for (2 min at most), then the case is BLOCKED', async () => {
  const { waitPhoneFree } = await import('../../src/run/phoneReady');
  let calls = 0;
  const freeLater = await waitPhoneFree(async () => (++calls < 3 ? 'another test session' : null), 1000, 10);
  expect(freeLater).toBeNull();
  expect(calls).toBe(3);
  const started = Date.now();
  const held = await waitPhoneFree(async () => 'another test session', 200, 20);
  expect(Date.now() - started).toBeLessThan(1500);
  expect(held).toContain('used by something else');
  expect(held).toContain('another test session');
});

test('review G14: the lock screen is waited for by looking again until it is gone, never a fixed sleep', async () => {
  const { lockGoneWithin } = await import('../../src/run/phoneReady');
  let looks = 0;
  const started = Date.now();
  expect(await lockGoneWithin(async () => ++looks < 3, 2000, 10)).toBe(true);
  expect(Date.now() - started).toBeLessThan(500); // gone at the third look, not after a fixed wait
  expect(await lockGoneWithin(async () => true, 100, 10)).toBe(false);
});
