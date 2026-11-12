import { expect, test } from '@playwright/test';
import { PhoneActions } from '../../src/phone/phoneActions';
import { PhoneAid, PhoneStuck } from '../../src/phone/phoneHelpAsk';
import { Phone } from '../../src/phone/phoneSession';
import { optionalPopupSeconds, popupKind, systemPopup } from '../../src/phone/optionalPopup';
import { checkTrue } from '../../src/report/checks';

/**
 * Omar 2026-11-12 (Test 8094 run 985, case 519): Android's own permission question (location, notifications, camera ...)
 * may or may not appear - it never decides a case by itself. Not there = the step that waits for it is skipped at once
 * (no AI help, no failure) with a warning; there = allowed and the case goes on, with a warning. The case passes only on
 * its own checks: the trap (a wrong check after the pop-up was handled) still FAILS.
 */
const ALLOW_LOCATION = "//android.widget.Button[@resource-id='permission_allow_foreground_only_button' or @resource-id='permission_allow_one_time_button']";
const WELCOME = "//android.view.View[contains(@content-desc, 'Welcome')]";
const PROFILE = "//android.widget.Button[contains(@content-desc, 'My Profile')]";
const HOME = `<hierarchy>
  <android.view.View content-desc="Welcome Omar" bounds="[0,0][400,100]"/>
  <android.widget.ImageView resource-id="checkin_button" bounds="[0,200][400,300]"/>
</hierarchy>`;
const QUESTION = `<hierarchy>
  <android.widget.TextView resource-id="com.android.permissioncontroller:id/permission_message" text="Allow Availo to access this device's location?" bounds="[100,1200][980,1400]"/>
  <android.widget.Button resource-id="com.android.permissioncontroller:id/permission_allow_foreground_only_button" bounds="[100,1500][980,1640]"/>
  <android.widget.Button resource-id="com.android.permissioncontroller:id/permission_deny_button" bounds="[100,1820][980,1960]"/>
</hierarchy>`;

class SignInLike extends PhoneActions {
  allowLocation(seconds = 5): Promise<void> {
    return this.tap(ALLOW_LOCATION, seconds, 'Allow (location)');
  }

  welcomeShown(): Promise<boolean> {
    return this.shows('Welcome', 0);
  }

  openProfile(): Promise<void> {
    return this.tap(PROFILE, 0, 'My Profile');
  }

  openWelcome(): Promise<void> {
    return this.tap(WELCOME, 0, 'Welcome');
  }
}

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

const noAid = (seen: PhoneStuck[]): PhoneAid => async (where) => { seen.push(where); return null; };

/** the live lines the step printed (Trova's run reads them) */
async function printed(work: () => Promise<unknown>): Promise<{ lines: Record<string, unknown>[]; error?: Error }> {
  const lines: Record<string, unknown>[] = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    for (const l of String(chunk).split('\n')) if (l.startsWith('@@live ')) lines.push(JSON.parse(l.slice(7)));
    return true;
  }) as typeof process.stdout.write;
  try {
    await work();
    return { lines };
  } catch (e) {
    return { lines, error: e as Error };
  } finally {
    process.stdout.write = write;
  }
}

const popups = (lines: Record<string, unknown>[]) => lines.filter((l) => l.t === 'popup').map((l) => ({ popup: l.popup, appeared: l.appeared }));

test('run 985: the location question that did not come is skipped - no AI help, no failure, a warning that it did not appear', async () => {
  const { phone, shells } = phoneShowing(HOME);
  const seen: PhoneStuck[] = [];
  const { lines, error } = await printed(() => new SignInLike(phone, noAid(seen)).allowLocation(0));
  expect(error).toBeUndefined();
  expect(seen).toEqual([]);
  expect(shells).toEqual([]);
  expect(popups(lines)).toEqual([{ popup: 'location', appeared: false }]);
});

test('the location question that came is allowed and the case goes on - a warning that the app asked', async () => {
  const { phone, shells } = phoneShowing(QUESTION, HOME);
  const { lines, error } = await printed(() => new SignInLike(phone, noAid([])).allowLocation(0));
  expect(error).toBeUndefined();
  expect(shells).toEqual([['input', 'tap', '540', '1570']]);
  expect(popups(lines)).toEqual([{ popup: 'location', appeared: true }]);
});

test('a question Trova answered for a step it covered says so too, then the step taps its own element', async () => {
  const { phone, shells } = phoneShowing(QUESTION, HOME);
  const { lines, error } = await printed(() => new SignInLike(phone, noAid([])).openWelcome());
  expect(error).toBeUndefined();
  expect(shells).toEqual([['input', 'tap', '540', '1570'], ['input', 'tap', '200', '50']]);
  expect(popups(lines)).toEqual([{ popup: 'location', appeared: true }]);
});

test('TRAP: the pop-up was handled but the real check is wrong - the case still FAILS', async () => {
  const { phone } = phoneShowing(QUESTION, '<hierarchy></hierarchy>');
  const s = new SignInLike(phone, noAid([]));
  const { lines, error } = await printed(async () => {
    await s.allowLocation(0);
    checkTrue('App opened · Welcome shows', await s.welcomeShown());
  });
  expect(popups(lines)).toEqual([{ popup: 'location', appeared: true }]);
  expect(error).toBeDefined();
});

test('TRAP: the pop-up did not come and the real element is missing - the case still FAILS, naming the element', async () => {
  const { phone } = phoneShowing('<hierarchy></hierarchy>');
  const seen: PhoneStuck[] = [];
  const s = new SignInLike(phone, noAid(seen));
  const { error } = await printed(async () => {
    await s.allowLocation(0);
    await s.openProfile();
  });
  expect(error?.message).toBe('My Profile did not show within 0 s');
  expect(seen).toHaveLength(1); // the real step still asks for AI help - only the pop-up is optional
});

test('a step that is not a system pop-up is never optional', () => {
  expect(systemPopup(PROFILE)).toBe(false);
  expect(systemPopup(ALLOW_LOCATION)).toBe(true);
  expect(systemPopup("//android.widget.Button[@resource-id='com.android.permissioncontroller:id/permission_deny_button']")).toBe(true);
});

test('boundary: a pop-up step waits at most 3 s, a shorter wait stays as it is', () => {
  expect(optionalPopupSeconds(30)).toBe(3);
  expect(optionalPopupSeconds(3)).toBe(3);
  expect(optionalPopupSeconds(1)).toBe(1);
});

test('the pop-up is named in plain words from the step or the question', () => {
  expect(popupKind('Allow (location)')).toBe('location');
  expect(popupKind("Allow Availo to send you notifications?")).toBe('notifications');
  expect(popupKind('Allow Availo to take pictures and record video?')).toBe('camera');
  expect(popupKind('Allow')).toBe('permission');
});
