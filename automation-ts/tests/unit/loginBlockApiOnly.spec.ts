import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseSuite } from '../../src/run/suitePlan';

/**
 * Run 687 (owner): "Log in programmatically" signs in by quick calls only (Login + Verify code) - like the set-up by
 * API it opens no browser and shows no picture; the first web case's own start proves the app opens signed in.
 */
test("every suite's sign-in block is quick calls only: no web or phone spec, not in the Web or Mob group", () => {
  const dir = path.resolve(__dirname, '..', '..', 'suites');
  const screen = fs.readdirSync(dir).filter((f) => f.endsWith('-ts.xml')).flatMap((f) => {
    // every sign-in block ("Log in programmatically", "... - the admin on the web"); the phone leave suite's employee
    // sign-in is the phone app's own quick calls (its spec sits with the phone cases)
    const phoneApi = 'tests/mobile/leaveRequest/leaveRequest.spec.ts';
    return parseSuite(fs.readFileSync(path.join(dir, f), 'utf8')).blocks.filter((b) => /^log in programmatically/i.test(b.name))
      .filter((b) => b.groups.length > 0 || b.tests.some((t) => !t.spec.startsWith('tests/api/') && t.spec !== phoneApi))
      .map((b) => `${f}: ${b.name}`);
  });
  expect(screen).toEqual([]);
});
