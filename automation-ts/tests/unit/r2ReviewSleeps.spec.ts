import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Round 2 review (test partner), guard G14: condition waits only. Page and screen code may keep the waits it has (a
 * look every few hundred ms until something shows); a NEW fixed sleep fails here - wait on what the case needs instead.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const SLEEP = /waitForTimeout\(|setTimeout\(\s*(?:r|resolve)\b|\.pause\(|\bsleep\(/g;
const FIXED = /waitForTimeout\(\s*\d|setTimeout\(\s*(?:r|resolve)\s*,\s*\d|\.pause\(\s*\d/;

/** the sleeps page and screen code has today (2026-11-11): only fewer is allowed */
const KNOWN: Record<string, number> = {
  'src/web/browserMessages.ts': 2, 'src/web/browserUp.ts': 1, 'src/web/covers.ts': 1, 'src/web/labelledValues.ts': 1,
  'src/web/pages/WorkPlanCalendar.ts': 2, 'src/web/pages/WorkPlanColours.ts': 1, 'src/web/signin/aiHelpAsk.ts': 1,
  'src/web/signin/appProof.ts': 1, 'src/web/signin/pageSettingsCapture.ts': 1, 'src/web/signin/screenSignIn.ts': 3,
  'src/web/signin/signInAct.ts': 1, 'src/web/signin/signInHolds.ts': 1, 'src/web/signin/signInPage.ts': 1,
  'src/web/timePicker.ts': 1, 'src/web/webActions.ts': 8, 'src/web/webTest.ts': 1, 'src/phone/appiumServer.ts': 1,
  'src/phone/keptPhone.ts': 1, 'src/phone/phoneActions.ts': 2, 'src/phone/phoneFilmPlayer.ts': 1,
  'src/phone/screens/AccountCodeScreen.ts': 2, 'src/phone/screens/LeaveRequestScreen.ts': 1, 'src/phone/screens/SignInScreen.ts': 2,
  'src/core/phoneTyping.ts': 1, 'tests/mobile/leaveRequest/leaveOnPhone.ts': 1,
  // merged from dev (cases pair, 2026-11-11): each a look inside a loop that ends on its condition or its time limit
  'tests/web/leaveRequests/requestOfTheEmployee.ts': 2, 'tests/mobile/leaveRequest/sentByApi.ts': 1, 'src/web/pages/TransactionsPage.ts': 1,
};

/** the files round 2 added: their waits are new, so none of them sleeps a fixed time */
const ADDED_BY_R2 = [
  'src/phone/phoneFree.ts', 'src/phone/phoneHeld.ts', 'src/phone/phoneWarmUp.ts', 'src/phone/phoneWarmUpDeps.ts',
  'src/run/phoneReady.ts', 'src/run/preRunApply.ts', 'src/run/preRunCheck.ts', 'src/run/preRunProbes.ts',
  'src/run/runStops.ts', 'src/run/retryBook.ts', 'src/run/trovaTest.ts', 'src/web/signin/robotTimeout.ts',
];

function files(dir: string): string[] {
  const at = path.join(ROOT, dir);
  if (!fs.existsSync(at)) return [];
  return fs.readdirSync(at, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(rel) : e.name.endsWith('.ts') ? [rel] : [];
  });
}

const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('no new fixed sleep in page or screen code - condition waits only', () => {
  const more = ['src/web', 'src/phone', 'src/core', 'tests/web', 'tests/mobile'].flatMap(files)
    .map((f) => ({ f, n: [...read(f).matchAll(SLEEP)].length }))
    .filter(({ f, n }) => n > (KNOWN[f] ?? 0))
    .map(({ f, n }) => `${f}: ${n} (known ${KNOWN[f] ?? 0})`);
  expect(more).toEqual([]);
});

test('the waits round 2 added look for a condition - none sleeps a fixed time', () => {
  expect(ADDED_BY_R2.filter((f) => FIXED.test(read(f)))).toEqual([]);
});
