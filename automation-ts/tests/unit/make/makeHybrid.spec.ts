import { expect, test } from '@playwright/test';
import { made, rawIn } from './makeFixtures';

/**
 * Make automation - hybrid kind: the run's one sign-in and the set-up / clean-up by the app's API (src/api/services, Trova's
 * known calls), the steps on the screens. The clean-up deletes only what this run made.
 */
test('a run with set-up and clean-up by API and steps on the web is made a hybrid web test', () => {
  const d = made('hybrid');
  expect(d.refused).toBeUndefined();
  expect(d.kind).toBe('hybrid');
  expect(d.spec.path).toMatch(/^tests\/web\/\w+\/\w+\.spec\.ts$/);
  expect(d.spec.text).toMatch(/import \{ webTest as test \} from '(\.\.\/)+src\/web\/webTest';/);
  expect(d.suiteBlocks).not.toContain('<parameter name="mode" value="ui"/>');
});

test('the set-up and clean-up calls go into an API class under src/api/services as Trova\'s known calls', () => {
  const d = made('hybrid');
  const api = d.files.find((f) => /^src\/api\/services\/\w+Api\.ts$/.test(f.path));
  expect(api?.isNew).toBe(true);
  expect(api?.text).toMatch(/export class \w+Api \{/);
  expect(api?.text).toContain('constructor(private readonly api: AppApi)');
  expect(api?.text).toContain("'POST /Holiday/AddHoliday'");
  expect(api?.text).toContain("'POST /Holiday/DeleteHoliday'");
  expect(api?.text).toMatch(/this\.api\.call\(/);
});

test('the test signs in once by API as the block\'s login and never calls the app itself', () => {
  const d = made('hybrid');
  expect(d.spec.text).toMatch(/AppApi\.signedInAs\(runLogin\(param\('signedInAs'/);
  expect(rawIn(d.spec.text)).toEqual([]);
  expect(d.suiteBlocks).toContain('<parameter name="signedInAs" value="Admin"/>');
});

test('what the set-up made is kept for the run, and the clean-up is its own test after the case', () => {
  const d = made('hybrid');
  expect([d.spec.text, ...d.files.map((f) => f.text)].join('\n')).toContain('runRecords.keep(');
  const cleanUp = /test\('(cleanUp\w+)'/.exec(d.spec.text)?.[1];
  expect(cleanUp).toBeDefined();
  expect(d.suiteBlocks.indexOf(`<include name="${cleanUp}"/>`)).toBeGreaterThan(d.suiteBlocks.indexOf(`<include name="${d.method}"/>`));
  expect(d.suiteBlocks).toMatch(/<test name="Clean up[^"]*">/);
});

test('the steps run on the page class and check both values the AI saw', () => {
  const d = made('hybrid');
  expect(d.files.some((f) => /^src\/web\/pages\/Holidays\w*Page\.ts$/.test(f.path))).toBe(true);
  expect(d.spec.text).toMatch(/check(True|Contains|Equals)\('[^']*The holiday shows with its date/);
  expect(d.spec.text).toMatch(/param\('holiday_name'/);
  expect(d.spec.text).toMatch(/param\('holiday_date'/);
});
