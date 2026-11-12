import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { workPlanKind } from '../../../src/api/records/workPlanKind';
import { WorkPlanCleanUpApi } from '../../../src/api/services/workPlanCleanUpApi';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';

/** Clean-up of the Plans suite (PlansApiTests): deletes by id the plans this run made, their shifts first, each read back gone. */
test('cleanUpPlansProgrammatically', async () => {
  const login = runLogin(param('signedInAs', 'Account Manager - Plan'));
  await cleanUpRun([workPlanKind(once(async () => new WorkPlanCleanUpApi(await AppApi.signedInAs(login, 'web'))))]);
});
