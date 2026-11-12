import { trovaTest as test } from '../../../src/run/trovaTest';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { overtimeRequests, todaysRequest } from './overtimeSetUpSteps';

/**
 * Set-up: an employee sends an overtime request for today the way the phone app does (the second employee when the
 * first already has today's); the manager's list must give its id - "Made overtime request id <id>", else FAILED with
 * the app's own words.
 */
test('setUpAnEmployeeWithAPendingOvertimeRequestForToday', async () => {
  await todaysRequest();
});

/** Clean-up: each request this run made is withdrawn by id by its own employee and read back gone from the list. */
test('cleanUpProgrammatically', async () => {
  await cleanUpRun([overtimeRequests()]);
});
