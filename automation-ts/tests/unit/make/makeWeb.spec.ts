import { expect, test } from '@playwright/test';
import { made, rawIn } from './makeFixtures';

/**
 * Make automation - web UI kind (full screen mode): a passed AI run on a page with no page class yet becomes a test on
 * a new page class in src/web/pages; the run's one sign-in comes from the web test base (never typed by the test) and
 * the clean-up goes through the screens, never the API.
 */
test('a web run in full screen mode is made a web test', () => {
  const d = made('webUi');
  expect(d.refused).toBeUndefined();
  expect(d.kind).toBe('web');
  expect(d.spec.path).toMatch(/^tests\/web\/\w+\/\w+\.spec\.ts$/);
  expect(d.spec.isNew).toBe(true);
  expect(d.method).toMatch(/^test[A-Z]\w+$/);
  expect(d.spec.text).toContain(`test('${d.method}'`);
});

test('the test uses the web test base and the new page class - no locator, click or call in the test itself', () => {
  const d = made('webUi');
  expect(d.spec.text).toMatch(/import \{ webTest as test \} from '(\.\.\/)+src\/web\/webTest';/);
  expect(d.spec.text).toMatch(/import \{ LeaveTypesPage \} from '(\.\.\/)+src\/web\/pages\/LeaveTypesPage';/);
  expect(d.spec.text).toContain('new LeaveTypesPage(page)');
  expect(rawIn(d.spec.text)).toEqual([]);
});

test('the new page class holds the elements the AI used, one class in its own file under src/web/pages', () => {
  const d = made('webUi');
  const page = d.files.find((f) => f.path === 'src/web/pages/LeaveTypesPage.ts');
  expect(page?.isNew).toBe(true);
  expect(page?.text).toMatch(/export class LeaveTypesPage extends (WebActions|BasePage) \{/);
  expect(page?.text.match(/export class /g)).toHaveLength(1);
  for (const locator of ["//button[normalize-space()='New leave type']", "//input[@formcontrolname='name']",
    "//input[@formcontrolname='days']", "//button[@type='submit'][normalize-space()='Save']"]) {
    expect(page?.text).toContain(locator);
  }
  expect(d.added.length).toBeGreaterThanOrEqual(4);
  expect(d.added.every((m) => m.startsWith('LeaveTypesPage.'))).toBe(true);
});

test('the case values are block values with their names - the test reads them, never a typed value', () => {
  const d = made('webUi');
  expect(d.spec.text).toMatch(/param\('leave_type_name'/);
  expect(d.spec.text).toMatch(/param\('leave_type_days'/);
  expect(d.suiteBlocks).toContain('<parameter name="leave_type_name" value="Trova leave {run}"/>');
  expect(d.suiteBlocks).toContain('<parameter name="leave_type_days" value="5"/>');
});

test('one sign-in per run: the AI\'s sign-in step is not repeated, the block names the login and the full screen mode', () => {
  const d = made('webUi');
  expect(d.spec.text).not.toMatch(/signIn\w*\(|logIn\w*\(|login\(|credentials\.|SignIn(Screen|Page)|\/login/i);
  expect(d.suiteBlocks).toContain('<parameter name="signedInAs" value="Admin"/>');
  expect(d.suiteBlocks).toContain('<parameter name="mode" value="ui"/>');
});

test('the expected result is checked by the test, named in plain words', () => {
  const d = made('webUi');
  expect(d.spec.text).toMatch(/check(True|Contains|Equals)\('[^']*The new leave type shows in the list/);
  expect(d.spec.text).toMatch(/import \{[^}]*check\w+[^}]*\} from '(\.\.\/)+src\/report\/checks';/);
});

test('full screen mode: the clean-up is its own test on the screens, never by API, and the suite runs it after the case', () => {
  const d = made('webUi');
  expect(d.spec.text).not.toMatch(/AppApi|src\/api\//);
  const cleanUp = /test\('(cleanUp\w+)'/.exec(d.spec.text)?.[1];
  expect(cleanUp).toBeDefined();
  const caseAt = d.suiteBlocks.indexOf(`<include name="${d.method}"/>`);
  const cleanUpAt = d.suiteBlocks.indexOf(`<include name="${cleanUp}"/>`);
  expect(caseAt).toBeGreaterThan(-1);
  expect(cleanUpAt).toBeGreaterThan(caseAt);
});

test('the suite block names the case and runs the new test from its file', () => {
  const d = made('webUi');
  expect(d.suiteBlocks).toContain('<test name="Case 501 - Admin adds a leave type">');
  expect(d.suiteBlocks).toContain(`<class name="ts:${d.spec.path}">`);
  expect(d.suiteBlocks).toMatch(/<test name="Clean up[^"]*">/);
  expect(d.suiteBlocks).toContain('<include name="Web"/>');
});
