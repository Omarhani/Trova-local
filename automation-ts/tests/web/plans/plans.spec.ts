import { MADE_PLANS } from '../../../src/api/services/workPlanApi';
import { dayOf, time24 } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals, checkFalse, checkTrue } from '../../../src/report/checks';
import { refusedPage } from '../../../src/web/pageFacts';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';
import { webTest as test } from '../../../src/web/webTest';
import { madePlan, madePlanWithShift, putEmployeeOnShift, shiftData, takeEmployeeOffShift } from './planSteps';

/** Plans - the TS twin of tests.web.plans.PlansTests: work plans and their shifts; plans and shifts a test needs first are made by API. */
const DELETE_CURRENT_AND_FUTURE = 'حذف المناوبة الحاليه و المستقبليه';

/** passes only when the app really opened signed in (the page fixture signs in once and refuses a sign-in page) */
test('logInProgrammatically', async ({ page }) => {
  checkFalse('Sign-in · the app opened signed in', refusedPage(page.url()));
});

test('testVerifyThatG1VerifyThatAddingANewPlanSavesIt', async ({ page }) => {
  const name = param('shift_plan_name', 'Trova Plan {run:290}');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickAddPlan();
  await plans.enterPlanName(name);
  await plans.selectCountry(param('shift_plan_country', 'مصر'));
  await plans.turnOnEveryDay();
  await plans.clickSave();
  runRecords.keep(MADE_PLANS, name);

  checkEquals('Add plan · toast', await plans.toastShows('تم إضافة خطة عمل بنجاح'), 'تم إضافة خطة عمل بنجاح');
  checkTrue('Add plan · the plan is in the plan list', await plans.planShown(name));
});

test('testVerifyThatG2VerifyThatEditingAPlansDaysOffSavesIt', async ({ page }) => {
  const name = param('shift_plan_name', 'Trova Plan {run:291}');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlan(name, param('shift_plan_country', 'مصر'));
  await plans.reloadWorkPlans();
  await plans.clickPlanMenuItem(name, 'تعديل');
  await plans.setDay('سبت', false);
  await plans.setDay('جمعة', false);
  await plans.clickSave();

  checkEquals('Edit plan · toast', await plans.toastShows('تم تعديل الخطة بنجاح'), 'تم تعديل الخطة بنجاح');
});

test('testVerifyThatG3VerifyThatAddingARegularShiftSavesItsTimes', async ({ page }) => {
  const s = shiftData('292');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlan(s.plan, s.country);
  await plans.reloadWorkPlans();
  await plans.clickAddShift();
  await plans.enterShiftTitle(s.title);
  await plans.selectShiftPlan(s.plan);
  await plans.selectRepeat(param('shift_repeat', 'daily'));
  await plans.chooseStartDate(s.day);
  await plans.chooseTime('بداية الدوام', s.startTime);
  await plans.chooseTime('نهاية الدوام', s.endTime);
  await plans.chooseTime('الحد الأقصى لتسجيل الخروج', s.maxCheckout);
  await plans.saveShift();

  checkEquals('Add shift · toast', await plans.toastShows('تم إضافة المناوبة بنجاح'), 'تم إضافة المناوبة بنجاح');
  await plans.openShiftDetails(s.day, s.title);
  checkEquals('Shift details · start', await plans.detail('بداية الدوام'), time24(s.startTime));
  checkEquals('Shift details · end', await plans.detail('نهاية الدوام'), time24(s.endTime));
  checkEquals('Shift details · max check-out', await plans.detail('الحد الأقصى لتسجيل الخروج'), time24(s.maxCheckout));
  await plans.closeDialog();
});

test('testVerifyThatG4VerifyThatANewShiftStartsTomorrowByDefault', async ({ page }) => {
  const day = dayOf(param('shift_start_date', 'tomorrow'));
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickAddShift();

  checkEquals('New shift · start date', String(await plans.startDayShown()), day); // as dates: 9/11 = 09/11
  await plans.closeDialog();
  checkTrue('New shift · the form closed without saving', await plans.dialogClosed());
});

test('testVerifyThatG8VerifyThatRemovingTheEmployeeFromAShiftSavesIt', async ({ page }) => {
  const s = shiftData('297');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlanWithShift(s);
  await plans.reloadWorkPlans();
  await putEmployeeOnShift(plans, s.day, s.title);

  await takeEmployeeOffShift(plans, s.day, s.title);

  checkEquals('Edit shift · toast', await plans.toastShows('تم تعديل المناوبة بنجاح'), 'تم تعديل المناوبة بنجاح');
});

test('testVerifyThatG5VerifyThatThePlanFilterShowsOnlyThatPlansShifts', async ({ page }) => {
  const s = shiftData('294', 'shift_max_checkout', '6 pm');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlanWithShift(s);
  await plans.reloadWorkPlans();
  await plans.filterByPlan(s.plan);

  checkTrue('Plan filter · the plan\'s shift shows tomorrow', await plans.shiftShown(s.day, s.title));
  checkEquals('Plan filter · shifts tomorrow', await plans.shiftsOnDay(s.day, 1), 1);
});

test('testVerifyThatG10VerifyThatAPlanWithNoShiftsIsDeleted', async ({ page }) => {
  const plan = param('shift_plan_name', 'Trova Plan {run:299}');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlan(plan, param('shift_plan_country', 'مصر'));
  await plans.reloadWorkPlans();
  await plans.clickPlanMenuItem(plan, 'حذف');
  await plans.confirmDialog();

  checkEquals('Delete plan · toast', await plans.toastShows('تم حذف الخطة بنجاح'), 'تم حذف الخطة بنجاح');
  checkTrue('Delete plan · the plan is no longer in the list', await plans.planGone(plan));
});

test('testVerifyThatG6VerifyThatAPlanWithShiftsCannotBeDeleted', async ({ page }) => {
  const s = shiftData('295');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlanWithShift(s);
  await plans.reloadWorkPlans();
  await plans.clickPlanMenuItem(s.plan, 'حذف');
  await plans.confirmDialog();

  checkEquals('Delete plan · toast', await plans.toastShows('يوجد مناوبات مرتبطة بهذه الخطة'), 'يوجد مناوبات مرتبطة بهذه الخطة');
  checkTrue('Delete plan · the plan is still in the list', await plans.planShown(s.plan));
});

test('testVerifyThatG9VerifyThatAShiftWithNoEmployeesIsDeleted', async ({ page }) => {
  const s = shiftData('298');
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlanWithShift(s);
  await plans.reloadWorkPlans();
  await plans.openShiftDetails(s.day, s.title);
  await plans.clickDeleteIcon();
  await plans.chooseDeleteScope(DELETE_CURRENT_AND_FUTURE);
  await plans.confirmDialog();

  checkEquals('Delete shift · toast', await plans.toastShows('تم حذف المناوبة بنجاح'), 'تم حذف المناوبة بنجاح');
  checkTrue('Delete shift · the shift is gone from the calendar', await plans.shiftGone(s.day, s.title));
});

test('testVerifyThatG7VerifyThatAShiftWithAnEmployeeCannotBeDeleted', async ({ page }) => {
  const s = shiftData('296');
  const refused = 'لا يمكن حذف مناوبة مرتبطة بموظفين او ادارات';
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await madePlanWithShift(s);
  await plans.reloadWorkPlans();
  await putEmployeeOnShift(plans, s.day, s.title);

  try {
    await plans.openShiftDetails(s.day, s.title);
    await plans.clickDeleteIcon();
    await plans.chooseDeleteScope(DELETE_CURRENT_AND_FUTURE);
    await plans.confirmDialog();

    checkEquals('Delete shift · toast', await plans.toastShows(refused), refused);
    checkTrue('Delete shift · the shift is still in the calendar', await plans.shiftShown(s.day, s.title));
  } finally { // the employee goes off the shift so the shift and the plan can be deleted
    await plans.toastGone();
    await plans.closeDialog();
    await takeEmployeeOffShift(plans, s.day, s.title);
  }
});
