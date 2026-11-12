import { test as base } from '@playwright/test';
import { blockedSkip } from '../report/blockedSkip';
import { checksMade } from '../report/checks';
import { afterSteps, blockRole, retryGate, stopFor } from './caseGuard';
import { blockNow } from './blockNow';
import { recordsHanded } from './caseRecords';
import { onStepsEnd } from './stepsEnd';
import { retryBook } from './retryBook';
import { runStops } from './runStops';

/**
 * Round 2: the base of every TS case (API, web and phone). Before its steps: a second try that the reporter did not
 * allow steps aside at once (only a set-up problem is tried again); a run whose app server the pre-run check found down
 * is BLOCKED at once with its one reason (the phone stop is the phone's own: a clean-up by API in a phone spec runs). After them: a case that passed without a single check of its expected result FAILS.
 */
export const trovaTest = base.extend<{ trovaCase: void }>({
  trovaCase: [async ({}, use, testInfo) => {
    const role = blockRole(testInfo.title, testInfo.project.name);
    blockNow.set(role); // run 973: a clean-up runs by API even after a case's sign-in was stopped
    const kept = retryGate(testInfo.retry, retryBook.allowed(testInfo.testId));
    testInfo.skip(kept !== undefined, kept);
    const stopped = stopFor('api', runStops.read()); // the app's server: every case; the phone: only a case that uses it (phoneTest)
    if (stopped) blockedSkip(testInfo, 'setup', stopped);
    const before = { checks: checksMade(), records: recordsHanded() };
    let atStepsEnd: number | undefined;
    onStepsEnd(testInfo, () => { atStepsEnd = checksMade(); }); // a check in the case's clean-up (afterEach) does not count
    await use();
    blockNow.set(undefined);
    const v = afterSteps(role, testInfo.status ?? '', (atStepsEnd ?? checksMade()) - before.checks, recordsHanded() - before.records);
    if (v.blocked) blockedSkip(testInfo, 'setup', v.blocked);
    if (v.failed) throw new Error(v.failed);
  }, { auto: true }],
});
