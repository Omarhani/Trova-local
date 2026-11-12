import { expect, test } from '@playwright/test';
import { made, rawIn } from './makeFixtures';

/**
 * Make automation - phone kind (Appium): the steps go to the screen classes in src/phone/screens (an existing method
 * reused, a missing one added to its screen, a new screen in its own file), on the run's ONE kept phone session (the
 * phone test base) and the run's one sign-in (the app opened signed in, the code types the saved login).
 */
test('a phone run is made a phone test on the phone test base', () => {
  const d = made('phone');
  expect(d.refused).toBeUndefined();
  expect(d.kind).toBe('phone');
  expect(d.spec.path).toMatch(/^tests\/mobile\/\w+\/\w+\.spec\.ts$/);
  expect(d.spec.text).toMatch(/import \{ phoneTest as test \} from '(\.\.\/)+src\/phone\/phoneTest';/);
  expect(d.spec.text).toMatch(new RegExp(`test\\('${d.method}', async \\(\\{ phone \\}\\)`));
});

test('the steps call screen methods only - an existing one is reused, never a raw tap', () => {
  const d = made('phone');
  expect(rawIn(d.spec.text)).toEqual([]);
  expect(d.reused).toContain('HomeAccount.openMyProfile');
  expect(d.spec.text).toContain('.openMyProfile()');
  expect(d.files.find((f) => f.path === 'src/phone/screens/HomeAccount.ts')).toBeUndefined(); // nothing added there
});

test('a missing tap is added to its screen class, which keeps everything it had', () => {
  const d = made('phone');
  const profile = d.files.find((f) => f.path === 'src/phone/screens/ProfileScreen.ts');
  expect(profile?.isNew).toBe(false);
  expect(profile?.text).toContain("//android.widget.Button[@content-desc='My payslips']");
  for (const kept of ['async changePassword(', 'async logOut(', 'changePasswordButton']) expect(profile?.text).toContain(kept);
  expect(d.added.filter((m) => m.startsWith('ProfileScreen.'))).toHaveLength(1);
});

test('a screen with no class yet gets its own screen class under src/phone/screens', () => {
  const d = made('phone');
  const screen = d.files.find((f) => /^src\/phone\/screens\/Payslips\w*Screen\.ts$/.test(f.path));
  expect(screen?.isNew).toBe(true);
  expect(screen?.text).toMatch(/export class Payslips\w*Screen extends PhoneActions \{/);
  expect(screen?.text).toContain("(//android.view.View[contains(@content-desc, 'Payslip')])[1]");
});

test('one kept phone session and one sign-in: the test never starts a session or signs in on the screens itself', () => {
  const d = made('phone');
  expect(d.spec.text).not.toMatch(/remote\(|new Phone|phoneSession|SignInScreen|credentials\.|\.signIn\(/);
  expect(d.spec.text).toMatch(/import \{ openSignedIn \} from '(\.\.\/)+src\/phone\/signedInPhone';/);
  expect(d.spec.text).toMatch(/await openSignedIn\(phone/);
  expect(d.suiteBlocks).toContain('<parameter name="keepAppData" value="true"/>');
  expect(d.suiteBlocks).toContain('<parameter name="signedInAs" value="Mobile user"/>');
  expect(d.suiteBlocks).toContain('<include name="Mob"/>');
});

test('the expected result of the phone step is checked', () => {
  const d = made('phone');
  expect(d.spec.text).toMatch(/check(True|Contains|Equals)\('[^']*The payslip of this month shows its net salary/);
  expect(d.spec.text).toContain('Net salary');
});
