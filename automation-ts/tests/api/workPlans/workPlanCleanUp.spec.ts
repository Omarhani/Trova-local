import { trovaTest as test } from '../../../src/run/trovaTest';
import { adminLogin } from '../../../src/api/flows/employeeValues';
import { AppApi } from '../../../src/api/appApi';
import { workPlanKind } from '../../../src/api/records/workPlanKind';
import { WorkPlanCleanUpApi } from '../../../src/api/services/workPlanCleanUpApi';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';

/**
 * The safety net of the work plans suite: deletes by id exactly the plans this run made, every shift in them first, and
 * reads each back gone - one line per plan. Run 1033 (Omar 2026-11-13): it only listed the plans and said "the delete
 * case removed it" when nothing was made; now nothing made = "Nothing to delete - this run made no work plan".
 */
test('cleanUpWorkPlansProgrammatically', async () => {
  await cleanUpRun([workPlanKind(once(async () => new WorkPlanCleanUpApi(await AppApi.signedInAs(adminLogin(), 'web'))))]);
});
