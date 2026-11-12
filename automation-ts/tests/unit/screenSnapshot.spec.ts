import { expect, test } from '@playwright/test';
import { ScreenSnapshot } from '../../src/phone/screenSnapshot';

/** Test 8094 runs 587/588 (147-184 s, AI 102 s): the screen is read once per look and asked in memory, like the AI-run tools. */
const xml = `<hierarchy>
  <node class="android.widget.EditText" resource-id="account_code_text_field" text="" bounds="[90,1042][990,1198]"/>
  <node class="android.widget.CheckBox" resource-id="server_checkbox_Live" checkable="true" checked="true" content-desc="Live" bounds="[90,1420][990,1520]"/>
  <node class="android.widget.CheckBox" resource-id="server_checkbox_Test" checkable="true" checked="false" content-desc="Test" bounds="[90,1640][990,1740]"/>
  <node class="android.view.View" content-desc="Check in" bounds="[0,0][10,10]"/>
  <node class="android.widget.Button" resource-id="account_code_next_button" bounds="[90,1910][990,2070]"/>
</hierarchy>`;

test('an element named by its resource id in an XPath is found', () => {
  const s = ScreenSnapshot.of(xml);
  expect(s.has("//android.widget.EditText[@resource-id='account_code_text_field']")).toBe(true);
  expect(s.has('//*[@resource-id="login_button"]')).toBe(false);
});

test('an XPath with several ids or descriptions matches any of them', () => {
  const s = ScreenSnapshot.of(xml);
  expect(s.has("//android.widget.ImageView[@resource-id='checkin_button' or @resource-id='checkout_button']")).toBe(false);
  expect(s.has('//android.view.View[@content-desc="Check in" or @content-desc="تسجيل حضور"]')).toBe(true);
});

test('server boxes come with their name, ticked state and place', () => {
  expect(ScreenSnapshot.of(xml).boxes('server_checkbox_')).toEqual([
    { id: 'server_checkbox_Live', checked: true, bounds: [90, 1420, 990, 1520] },
    { id: 'server_checkbox_Test', checked: false, bounds: [90, 1640, 990, 1740] },
  ]);
});

test('the middle of an element is where a finger taps', () => {
  expect(ScreenSnapshot.of(xml).middle("//android.widget.Button[@resource-id='account_code_next_button']")).toEqual([540, 1990]);
});

test('trap: a locator the snapshot cannot read is never guessed as present', () => {
  const e = (() => { try { ScreenSnapshot.of(xml).has('(//android.widget.Button)[2]'); return undefined; } catch (x) { return x as Error; } })();
  expect(e?.name).toBe('SetUpProblem'); // our step, never the app: Not checked
  expect(e?.message).toBe('Not checked - our test step needs a look: it names its element in a way Trova cannot read on the phone screen');
});

/** Real phone 2026-11-10: Appium's page tree names each element by its class (<android.widget.EditText ...>), not <node>. */
test('a page tree from Appium (elements named by class) is read the same', () => {
  const appium = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy index="0" class="hierarchy">
    <android.widget.EditText index="0" class="android.widget.EditText" resource-id="account_code_text_field" bounds="[90,1042][990,1198]"/>
    <android.widget.CheckBox index="1" class="android.widget.CheckBox" resource-id="server_checkbox_Test" checkable="true" checked="true" bounds="[90,1640][990,1740]"></android.widget.CheckBox>
  </hierarchy>`;
  const s = ScreenSnapshot.of(appium);
  expect(s.has("//android.widget.EditText[@resource-id='account_code_text_field']")).toBe(true);
  expect(s.boxes('server_checkbox_')).toEqual([{ id: 'server_checkbox_Test', checked: true, bounds: [90, 1640, 990, 1740] }]);
});

/** Phone leave case 2026-11-11: the date picker's days are "11, Wednesday, November 11, 2026" - found by how they start */
test('a description that starts with a text is found by starts-with, not by a look-alike that only contains it', () => {
  const days = `<hierarchy>
    <android.widget.Button class="android.widget.Button" content-desc="1, Sunday, November 1, 2026" bounds="[0,0][10,10]"/>
    <android.widget.Button class="android.widget.Button" content-desc="11, Wednesday, November 11, 2026" bounds="[20,0][30,10]"/>
  </hierarchy>`;
  const s = ScreenSnapshot.of(days);
  expect(s.middle("//android.widget.Button[starts-with(@content-desc, '11, ')]")).toEqual([25, 5]);
  expect(s.has("//android.widget.Button[starts-with(@content-desc, '12, ')]")).toBe(false);
});

/** the picker's next-month arrow has no description, only its tooltip ("Next month" / "الشهر التالي") */
test('an element named by its tooltip text is found', () => {
  const arrows = `<hierarchy>
    <android.widget.Button class="android.widget.Button" tooltip-text="الشهر السابق" bounds="[211,591][355,735]"/>
    <android.widget.Button class="android.widget.Button" tooltip-text="الشهر التالي" bounds="[67,591][211,735]"/>
  </hierarchy>`;
  const s = ScreenSnapshot.of(arrows);
  expect(s.middle("//android.widget.Button[@tooltip-text='Next month' or @tooltip-text='الشهر التالي']")).toEqual([139, 663]);
});

test('the box of a field: its own text, or the text box inside it, and whether it is a password box', () => {
  const s = ScreenSnapshot.of(`<hierarchy>
    <node class="android.view.View" resource-id="account_code" content-desc="Account Code" bounds="[0,100][500,200]" />
    <node class="android.widget.EditText" text="o.hany" password="false" bounds="[20,120][480,180]" />
    <node class="android.widget.EditText" resource-id="password" text="" password="true" bounds="[0,300][500,400]" />
  </hierarchy>`);
  expect(s.field("//android.view.View[@resource-id='account_code']")).toEqual({ text: 'o.hany', password: false });
  expect(s.field("//android.widget.EditText[@resource-id='password']")).toEqual({ text: '', password: true });
  expect(s.field("//android.widget.EditText[@resource-id='gone']")).toBeUndefined();
});

test('Omar 2026-11-11: the box of the element a step acts on and the screen size, for the run page to mark it like web', () => {
  const s = ScreenSnapshot.of(`<hierarchy>
    <node class="android.widget.FrameLayout" bounds="[0,0][1080,2400]" />
    <node class="android.widget.Button" resource-id="account_code_next_button" bounds="[90,1908][990,2075]" />
  </hierarchy>`);
  expect(s.mark("//android.widget.Button[@resource-id='account_code_next_button']")).toEqual({ b: [90, 1908, 990, 2075], sw: 1080, sh: 2400 });
  expect(s.mark("//android.widget.Button[@resource-id='gone']")).toBeUndefined();
});

test('run 870: an element named by part of its resource id (contains, with the package) is read, not refused', () => {
  const q = '<hierarchy><android.widget.Button resource-id="com.android.permissioncontroller:id/permission_allow_foreground_only_button" bounds="[100,1500][980,1640]"/></hierarchy>';
  const s = ScreenSnapshot.of(q);
  expect(s.has("//android.widget.Button[contains(@resource-id, 'com.android.permissioncontroller:id/permission_allow')]")).toBe(true);
  expect(s.has("//android.widget.Button[contains(@resource-id, 'permission_deny')]")).toBe(false);
});
