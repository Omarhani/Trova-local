import { expect, test } from '@playwright/test';
import { made, rawIn } from './makeFixtures';

/**
 * Make automation - API kind: every step is a call to the app's API. The calls go into an API class (src/api/services) as
 * Trova's known calls; the test checks each answer the AI checked (its status and the words it must hold).
 */
test('a run of API steps only is made an API test with no browser and no phone', () => {
  const d = made('api');
  expect(d.refused).toBeUndefined();
  expect(d.kind).toBe('api');
  expect(d.spec.path).toMatch(/^tests\/api\/\w+\/\w+\.spec\.ts$/);
  expect(d.spec.text).toMatch(/import \{[^}]*\btest\b[^}]*\} from '@playwright\/test';/);
  expect(d.spec.text).not.toMatch(/webTest|phoneTest|src\/web\/|src\/phone\//);
});

test('the calls live in an API class - the test calls its methods only', () => {
  const d = made('api');
  const api = d.files.find((f) => /^src\/api\/services\/\w+Api\.ts$/.test(f.path));
  expect(api?.text).toContain("'POST /Department/AddDepartment'");
  expect(api?.text).toContain("'POST /Department/GetAllDepartments'");
  expect(api?.text).toContain("'POST /Department/DeleteDepartment'");
  expect(rawIn(d.spec.text)).toEqual([]);
  expect(d.spec.text).toMatch(/AppApi\.signedInAs\(runLogin\(param\('signedInAs'/);
});

test('each answer is checked as the AI checked it: its status and the words it must hold', () => {
  const d = made('api');
  expect(d.spec.text).toMatch(/checkEquals\('[^']*The department is saved[^']*', [^;]*status[^;]*, 200\)/);
  expect(d.spec.text).toMatch(/checkContains\('[^']*The department is saved[^']*', [^;]*'Saved'\)/);
  expect(d.spec.text).toMatch(/checkContains\('[^']*The new department is in the list[^']*', [^;]*department/i);
});

test('the id the first answer gave is kept for the clean-up, which runs after the case', () => {
  const d = made('api');
  expect([d.spec.text, ...d.files.map((f) => f.text)].join('\n')).toContain('runRecords.keep(');
  const cleanUp = /test\('(cleanUp\w+)'/.exec(d.spec.text)?.[1];
  expect(cleanUp).toBeDefined();
  expect(d.suiteBlocks.indexOf(`<include name="${cleanUp}"/>`)).toBeGreaterThan(d.suiteBlocks.indexOf(`<include name="${d.method}"/>`));
  expect(d.suiteBlocks).toContain('<parameter name="department_name" value="Trova dept {run}"/>');
});
