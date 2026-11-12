import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { PendingUsersApi } from '../../../src/api/services/pendingUsersApi';
import { param } from '../../../src/run/blockParams';
import { cleanUpMade } from '../../../src/run/cleanUpMade';
import { runLogin } from '../../../src/run/credentials';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';
import { PENDING_JOBS } from '../../web/employeeAndLeavesRecords';

/** Set-up (sign in once by API) and clean-up (delete what the run made) of the Employee suites. */
test('logInProgrammatically', async () => {
  const admin = await AppApi.signedInAs(runLogin(param('signedInAs', 'Admin')), 'web');
  checkTrue('Sign-in · token received', admin !== undefined);
});

test('cleanUpProgrammatically', async () => {
  const jobs = runRecords.newestFirst(PENDING_JOBS);
  test.skip(jobs.length === 0, 'Nothing was kept by this run - nothing to delete');
  const requests = new PendingUsersApi(await AppApi.signedInAs(runLogin(param('signedInAs', 'Admin')), 'web'));
  // only what this run made, each checked gone by API; anything left fails this step
  const left = await cleanUpMade(jobs, requests, (job) => runRecords.forget(PENDING_JOBS, job));
  checkTrue(`Clean-up · the ${jobs.length} request(s) this run made are gone`, left.length === 0, left.length ? `still there: ${left.join(', ')}` : '');
});
