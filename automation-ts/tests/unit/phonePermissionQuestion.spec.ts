import { expect, test } from '@playwright/test';
import { PhoneActions } from '../../src/phone/phoneActions';
import { PhoneAid, PhoneStuck } from '../../src/phone/phoneHelpAsk';
import { Phone } from '../../src/phone/phoneSession';

/**
 * Test 8094 run 870 (healPhoneLocationQuestionInTheWay): Android's own permission question covered the app. Designed:
 * Trova answers it "allow" the way a person would (a known step, no AI needed) and the step goes on - the case PASSES.
 */
const PROFILE = "//android.widget.Button[contains(@content-desc, 'My Profile')]";
const DENY = "//android.widget.Button[@resource-id='com.android.permissioncontroller:id/permission_deny_button']";
const HOME = '<hierarchy><android.widget.Button content-desc="My Profile" bounds="[0,0][200,100]"/></hierarchy>';
const QUESTION = `<hierarchy>
  <android.widget.Button resource-id="com.android.permissioncontroller:id/permission_allow_foreground_only_button" bounds="[100,1500][980,1640]"/>
  <android.widget.Button resource-id="com.android.permissioncontroller:id/permission_allow_one_time_button" bounds="[100,1660][980,1800]"/>
  <android.widget.Button resource-id="com.android.permissioncontroller:id/permission_deny_button" bounds="[100,1820][980,1960]"/>
</hierarchy>`;
const EMPTY = '<hierarchy></hierarchy>';

class HomeScreen extends PhoneActions {
  openProfile(seconds = 0): Promise<void> {
    return this.tap(PROFILE, seconds, 'My Profile');
  }

  openUnnamed(): Promise<void> {
    return this.tap(PROFILE, 0);
  }

  deny(): Promise<void> {
    return this.tap(DENY, 0, "Don't allow");
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

const noAid = (seen: PhoneStuck[] = []): PhoneAid => async (where) => { seen.push(where); return null; };

test('Android\'s permission question in the way: allowed while the app is used, then the step taps its element - no AI asked', async () => {
  const { phone, shells } = phoneShowing(QUESTION, HOME);
  const seen: PhoneStuck[] = [];
  await new HomeScreen(phone, noAid(seen)).openProfile();
  expect(shells).toEqual([['input', 'tap', '540', '1570'], ['input', 'tap', '100', '50']]);
  expect(seen).toEqual([]);
});

test('a question asked twice in a row is answered twice, then the step goes on', async () => {
  const { phone, shells } = phoneShowing(QUESTION, QUESTION, HOME);
  await new HomeScreen(phone, noAid()).openProfile(1);
  expect(shells.filter((c) => c[3] === '1570')).toHaveLength(2);
  expect(shells[shells.length - 1]).toEqual(['input', 'tap', '100', '50']);
});

test('boundary: a question that keeps coming back is answered at most 3 times, then the step fails in plain words', async () => {
  const { phone, shells } = phoneShowing(QUESTION);
  const e = await new HomeScreen(phone, noAid()).openProfile().catch((x: Error) => x);
  expect(shells.filter((c) => c[3] === '1570')).toHaveLength(3);
  expect((e as Error).message).toBe('My Profile did not show within 0 s');
});

test('trap: a step that answers the question itself is never answered for it - "Don\'t allow" is tapped as asked', async () => {
  const { phone, shells } = phoneShowing(QUESTION);
  await new HomeScreen(phone, noAid()).deny();
  expect(shells).toEqual([['input', 'tap', '540', '1890']]);
});

test('no question and no element: the step fails naming the element, never its XPath', async () => {
  const { phone, shells } = phoneShowing(EMPTY);
  const e = await new HomeScreen(phone, noAid()).openProfile().catch((x: Error) => x);
  expect((e as Error).message).toBe('My Profile did not show within 0 s');
  expect((e as Error).message).not.toContain('//');
  expect(shells).toEqual([]);
});

test('an element the screen did not name is still said in plain words, never its XPath', async () => {
  const { phone } = phoneShowing(EMPTY);
  const e = await new HomeScreen(phone, noAid()).openUnnamed().catch((x: Error) => x);
  expect((e as Error).message).toBe('The element of this step did not show within 0 s');
});
