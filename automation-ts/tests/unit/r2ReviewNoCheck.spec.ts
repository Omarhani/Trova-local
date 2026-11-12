import { checkEquals, checkTrue } from '../../src/report/checks';
import { trovaTest as test } from '../../src/run/trovaTest';

/**
 * Round 2 review (test partner): "no pass without a check" counts only checks of the case's expected result. A set-up
 * case (setUp..., block "Set up - ...") hands records over and has no expected result of its own; a clean-up check is
 * not a check of what the case expects.
 */

test('setUpAnEmployeeWithAPendingOvertimeRequest', async () => {
  // as tests/api/overtimeManagement: makes the record and hands it over (caseRecords.made) - no check; it must not be FAILED
});

test('cleanUpWorkPlansProgrammatically', async () => {
  checkEquals('Clean-up · plans this run made still there', 'none', 'none'); // a clean-up case: its clean-up check is its result
});

test.describe('a case whose only check is in its clean-up', () => {
  test.afterEach(() => {
    checkTrue('Clean-up · the records this case made are gone', true);
  });

  test('is FAILED: no check of the expected result', async () => {
    test.fail(); // the case must end FAILED - the clean-up check after its steps does not count
  });
});
