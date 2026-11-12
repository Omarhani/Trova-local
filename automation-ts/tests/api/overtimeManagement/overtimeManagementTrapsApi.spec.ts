import { trovaTest as test } from '../../../src/run/trovaTest';
import { PENDING, REJECTED } from '../../web/overtimeRecords';
import { hand, rejectMade, todaysRequest } from './overtimeSetUpSteps';

/** Set-up blocks of the Overtime Management traps suite (OvertimeManagementTrapsApiTests): today's requests, 1 hour each. */
test('setUpPendingOvertimeRequestForViews', async () => {
  hand(undefined, PENDING, await todaysRequest(1));
});

test('setUpRejectedOvertimeRequest', async () => {
  const result = await todaysRequest(1);
  await rejectMade(result, true);
  hand(undefined, REJECTED, result);
});

test('setUpPendingOvertimeRequestForRejectWithReason', async () => {
  hand('Verify that rejecting with a reason approves the request', PENDING, await todaysRequest(1));
});

test('setUpPendingOvertimeRequestForApprove', async () => {
  hand('Verify that approving a pending request rejects it', PENDING, await todaysRequest(1));
});
