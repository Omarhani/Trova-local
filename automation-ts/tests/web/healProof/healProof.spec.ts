import { checkTrue } from '../../../src/report/checks';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';
import { webTest as test } from '../../../src/web/webTest';
import { HealProofPage } from '../../../src/web/pages/HealProofPage';

/**
 * Self-healing proof round (Omar 2026-11-11): each case breaks ONE thing on purpose and must end as designed -
 * 1 our renamed locator: AI help gets past, a treatment WAITS (Blocked "needs a look" until approved); 2 a pop-up in the
 * way: the AI closes it, PASSED; 3 the network cut: NOT CHECKED (Blocked, the environment); 4 the app's plan list
 * answering an error: FAILED (a real app bug). Proof C (healProofChecks.spec.ts) has the missed toast and the trap.
 * The work plans page only - nothing is saved in the app; every cut call is given back after its case.
 */
const PLAN_LIST = /\/WorkPlan\/GetAllWorkPlans/;

test('healOurRenamedLocator', async ({ page }) => {
  // stuck until a treatment fixes the link (Blocked "needs a look"); healed, it opens Work plans and passes by itself
  checkTrue('Proof · Work plans opened by its link', await new HealProofPage(page).openByRenamedLink());
});

test('healPopupInTheWay', async ({ page }) => {
  await new WorkPlansPage(page).openWorkPlans();
  const proof = new HealProofPage(page);
  await proof.coverWithPopup();
  checkTrue('Proof · Add plan opens its dialog after the pop-up is gone', await proof.addPlanOpens());
});

test('healNetworkCut', async ({ page }) => {
  await new WorkPlansPage(page).openWorkPlans();
  await page.route(PLAN_LIST, (r) => r.abort('internetdisconnected'));
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    checkTrue('Proof · the plan list showed with the network cut (it must not)', await new HealProofPage(page).planOptionsShow());
  } finally {
    await page.unroute(PLAN_LIST);
  }
});

test('healAppAnswersWrong', async ({ page }) => {
  await new WorkPlansPage(page).openWorkPlans();
  await page.route(PLAN_LIST, (r) => r.fulfill({ status: 500, contentType: 'application/json',
    body: JSON.stringify({ Data: null, Success: false, Message: 'حدث خطأ ما' }) }));
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    checkTrue('Proof · the plan list showed although the app answered an error (it must not)', await new HealProofPage(page).planOptionsShow());
  } finally {
    await page.unroute(PLAN_LIST);
  }
});
