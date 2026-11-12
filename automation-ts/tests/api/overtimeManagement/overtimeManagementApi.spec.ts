import { trovaTest as test } from '../../../src/run/trovaTest';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { PENDING, REJECTED } from '../../web/overtimeRecords';
import { hand, overtimeRequests, rejectMade, todaysRequest } from './overtimeSetUpSteps';

/**
 * Set-up (the employees' overtime requests for today) and clean-up (withdraw by id what the run made) -
 * OvertimeManagementApiTests. One request per employee per day: each set-up is a checked step with the app's own words.
 */
test('setUpAnEmployeeWithAPendingOvertimeRequest', async () => {
  hand(undefined, PENDING, await todaysRequest());
});

test('setUpAnOvertimeRequestRejected', async () => {
  const result = await todaysRequest();
  await rejectMade(result);
  hand(undefined, REJECTED, result);
});

test('setUpAPendingRequestForRejecting', async () => {
  hand('Verify that rejecting with a reason rejects the request', PENDING, await todaysRequest());
});

test('setUpAPendingRequestForApproving', async () => {
  hand('Verify that approving a pending request approves it', PENDING, await todaysRequest());
});

/** each request this run made is withdrawn by id and read back gone; a request a test decided is kept and said so */
test('cleanUpProgrammatically', async () => {
  await cleanUpRun([overtimeRequests()]);
});
