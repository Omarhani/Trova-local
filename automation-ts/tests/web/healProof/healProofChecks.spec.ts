import { MADE_PLANS } from '../../../src/api/services/workPlanApi';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals } from '../../../src/report/checks';
import { MissingData } from '../../../src/report/failureKind';
import { ChangedList, planNameSeen, withFirstPlanRenamed } from '../../../src/web/changedPlanList';
import { HealProofPage } from '../../../src/web/pages/HealProofPage';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';
import { webTest as test } from '../../../src/web/webTest';

/**
 * Self-healing proof C (Omar 2026-11-11): two failed checks, each with its designed end -
 * 3 a toast our read misses (our box name is wrong): FAILED check, first aid names OUR code, a treatment waits;
 * 6 TRAP - the page shows a plan name the server does not have: FAILED, NEVER healed (a heal may not hide an app bug).
 */
const PLAN_LIST = /\/WorkPlan\/GetAllWorkPlans/;
const ADDED = 'تم إضافة خطة عمل بنجاح';

test('healToastOurReadMisses', async ({ page }) => {
  const name = param('shift_plan_name', 'Trova Heal Proof Plan {run:3}');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickAddPlan();
  await plans.enterPlanName(name);
  await plans.selectCountry(param('shift_plan_country', 'مصر'));
  await plans.turnOnEveryDay();
  await plans.clickSave();
  runRecords.keep(MADE_PLANS, name); // the suite's API clean-up deletes it

  // the app shows its success toast; our read looks in a box the app does not have - fails until a treatment fixes it
  checkEquals('Proof · Add plan toast (read by our old box name)', await new HealProofPage(page).toastReadByOldBox(ADDED), ADDED);
});

test('healTrapAppShowsWrongValue', async ({ page }) => {
  await new WorkPlansPage(page).openWorkPlans();
  let changed: ChangedList | undefined;
  await page.route(PLAN_LIST, async (r) => {
    const real = await r.fetch();
    changed = withFirstPlanRenamed(await real.json().catch(() => null), ' (changed)');
    await r.fulfill(changed ? { response: real, json: changed.answer } : { response: real });
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    const names = await new HealProofPage(page).planFilterNames();
    if (!changed) throw new MissingData('Not tested - needs at least one work plan in the app (the trap changes the first one)');
    checkEquals('Trap · the plan filter shows the plan as the app\'s server has it', planNameSeen(names, changed.real, changed.shown), changed.real);
  } finally {
    await page.unroute(PLAN_LIST);
  }
});
