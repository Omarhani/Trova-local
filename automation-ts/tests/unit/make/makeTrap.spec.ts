import { expect, test } from '@playwright/test';
import { made } from './makeFixtures';

/**
 * Make automation - the trap twin: the same test with ONE wrong expectation, next to it. Its run must FAIL - proof that the
 * test's checks really look. It is used for that proof run and never goes into the tester's suite.
 */
const KINDS = ['webUi', 'phone', 'hybrid', 'api'];

for (const kind of KINDS) {
  test(`${kind}: a trap twin is made next to the test, named as its trap`, () => {
    const d = made(kind);
    expect(d.trap.path).not.toBe(d.spec.path);
    expect(d.trap.path.split('/').slice(0, -1)).toEqual(d.spec.path.split('/').slice(0, -1));
    expect(d.trap.path).toMatch(/Trap\.spec\.ts$/);
    expect(d.trap.text).toContain(`test('${d.method}Trap'`);
  });

  test(`${kind}: the trap differs from the test in exactly one check, its expected value`, () => {
    const d = made(kind);
    const test = d.spec.text.split(/\r?\n/);
    const trap = d.trap.text.split(`${d.method}Trap`).join(d.method).split(/\r?\n/);
    expect(trap).toHaveLength(test.length);
    const differ = test.map((line, i) => [line, trap[i]]).filter(([a, b]) => a !== b);
    expect(differ).toHaveLength(1);
    expect(differ[0][0]).toMatch(/check(True|Contains|Equals)\(/);
    expect(differ[0][1]).toMatch(/check(True|Contains|Equals)\(/);
  });

  test(`${kind}: the trap runs from its own blocks, never from the tester's suite`, () => {
    const d = made(kind);
    expect(d.trapBlocks).toContain(`<class name="ts:${d.trap.path}">`);
    expect(d.trapBlocks).toContain(`<include name="${d.method}Trap"/>`);
    expect(d.suiteBlocks).not.toContain('Trap');
  });
}
