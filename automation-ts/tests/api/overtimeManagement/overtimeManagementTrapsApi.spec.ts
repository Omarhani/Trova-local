import { trovaTest as test } from '../../../src/run/trovaTest';
import { REJECTED as REJECTED_STATUS } from '../../../src/api/services/overtimeApi';
import { param } from '../../../src/run/blockParams';
import { PENDING, REJECTED } from '../../web/overtimeRecords';
import { hand, setUp, todaysRequest } from './overtimeSetUpSteps';

/** Set-up blocks of the Overtime Management traps suite (OvertimeManagementTrapsApiTests): today's requests, 1 hour each. */
test('setUpPendingOvertimeRequestForViews', async () => {
  hand(undefined, PENDING, await todaysRequest(1));
});

test('setUpRejectedOvertimeRequest', async () => {
  const result = await todaysRequest(1);
  if (result.made !== undefined) {
    await (await setUp().manager()).post('OvertimeRequests/ApproveRejectOvertimeRequest',
      { RequestId: [result.made.id], Status: REJECTED_STATUS, Reason: param('reject_reason', 'Not needed') });
    console.log('Not deleted: the rejected overtime request made by this run - the app does not delete a decided request');
  }
  hand(undefined, REJECTED, result);
});

test('setUpPendingOvertimeRequestForRejectWithReason', async () => {
  hand('Verify that rejecting with a reason approves the request', PENDING, await todaysRequest(1));
});

test('setUpPendingOvertimeRequestForApprove', async () => {
  hand('Verify that approving a pending request rejects it', PENDING, await todaysRequest(1));
});
