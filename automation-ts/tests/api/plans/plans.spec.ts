import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { MADE_PLANS, WorkPlanApi } from '../../../src/api/services/workPlanApi';
import { dayOf } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { runRecords } from '../../../src/run/runRecords';
import { checkTrue } from '../../../src/report/checks';

/** Clean-up of the Plans suite (PlansApiTests): removes the plans this run made, their shifts first. */
test('cleanUpPlansProgrammatically', async () => {
  const names = runRecords.newestFirst(MADE_PLANS);
  test.skip(names.length === 0, 'Nothing was kept by this run - nothing to delete');
  const plans = new WorkPlanApi(await AppApi.signedInAs(runLogin(param('signedInAs', 'Account Manager - Plan')), 'web'));
  const start = dayOf(param('shift_start_date', 'tomorrow'));
  for (const name of names) { // shifts first, then the plan
    const id = await plans.planId(name);
    if (id !== undefined) {
      for (const shift of await plans.shiftIds(id, start)) await plans.deleteShift(shift, start);
      await plans.deletePlan(id);
    }
    checkTrue(`Clean-up · plan ${name} is gone`, (await plans.planId(name)) === undefined);
    runRecords.forget(MADE_PLANS, name);
  }
});
