import { trovaTest as test } from '../../../src/run/trovaTest';
import { adminLogin } from '../../../src/api/flows/employeeValues';
import { AppApi } from '../../../src/api/appApi';
import { MADE_PLANS } from '../../../src/api/services/workPlanApi';
import { WorkPlanCleanUpApi } from '../../../src/api/services/workPlanCleanUpApi';
import { cleanUpMade } from '../../../src/run/cleanUpMade';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals } from '../../../src/report/checks';
import { planValues } from '../../web/workPlans/workPlanSetUp';

/**
 * The safety net of the work plans suite: deletes the plans this run made with every shift in them (employees taken off
 * first) and checks by API each is gone. Run 768 (Omar 2026-11-11): when the delete case already removed this run's
 * plan, the block was SKIPPED on every good run - it now looks the plan up by its name and proves nothing is left.
 */
test('cleanUpWorkPlansProgrammatically', async () => {
  const plans = new WorkPlanCleanUpApi(await AppApi.signedInAs(adminLogin(), 'web'));
  const made = runRecords.newestFirst(MADE_PLANS);
  if (made.length === 0) {
    const name = planValues().plan;
    checkEquals(`Clean-up · this run's plan "${name}" is gone (the delete case removed it)`, (await plans.plan(name)) ? name : 'none', 'none');
    return;
  }
  const left = await cleanUpMade(made, {
    idOf: async (name) => ((await plans.plan(name)) ? name : undefined),
    delete: (name) => plans.deletePlanWithShifts(name),
  }, (name) => runRecords.forget(MADE_PLANS, name));
  checkEquals('Clean-up · plans this run made still there', left.join(', ') || 'none', 'none');
});
