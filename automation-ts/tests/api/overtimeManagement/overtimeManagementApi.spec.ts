import { trovaTest as test } from '../../../src/run/trovaTest';
import { OvertimeApi, PENDING as PENDING_STATUS, REJECTED as REJECTED_STATUS } from '../../../src/api/services/overtimeApi';
import { MADE_IDS } from '../../../src/api/services/overtimeSetUp';
import { AppApi } from '../../../src/api/appApi';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';
import { PENDING, REJECTED } from '../../web/overtimeRecords';
import { hand, setUp, todaysRequest } from './overtimeSetUpSteps';

/**
 * Set-up (the employees' overtime requests for today) and clean-up (withdraw what the run made) - OvertimeManagementApiTests.
 * One request per employee per day: a set-up after the employees have today's request is "Not tested" in the app's words.
 */
test('setUpAnEmployeeWithAPendingOvertimeRequest', async () => {
  hand(undefined, PENDING, await todaysRequest());
});

test('setUpAnOvertimeRequestRejected', async () => {
  const result = await todaysRequest();
  if (result.made !== undefined) {
    await (await setUp().manager()).call('POST /OvertimeRequests/ApproveRejectOvertimeRequest',
      { RequestId: [result.made.id], Status: REJECTED_STATUS, Reason: param('reject_reason', 'Not needed') });
  }
  hand(undefined, REJECTED, result);
});

test('setUpAPendingRequestForRejecting', async () => {
  hand('Verify that rejecting with a reason rejects the request', PENDING, await todaysRequest());
});

test('setUpAPendingRequestForApproving', async () => {
  hand('Verify that approving a pending request approves it', PENDING, await todaysRequest());
});

/** each pending request this run made is withdrawn by its own employee; a request a test decided stays */
test('cleanUpProgrammatically', async () => {
  const kept = runRecords.newestFirst(MADE_IDS);
  test.skip(kept.length === 0, 'Nothing was kept by this run - nothing to delete');
  const manager = await setUp().manager();
  for (const record of kept) {
    const [login, id] = record.split('|');
    const row = (await OvertimeApi.list(manager)).find((r) => String(r.Id) === id);
    if (row !== undefined && row.Status === PENDING_STATUS) {
      await OvertimeApi.delete(await AppApi.signedInAs(login, 'phone'), Number(id));
      checkTrue(`Clean-up · request ${id} is gone`, !(await OvertimeApi.list(manager)).some((r) => String(r.Id) === id));
    }
    runRecords.forget(MADE_IDS, record);
  }
});
