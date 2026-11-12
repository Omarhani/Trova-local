import { WORK_PLAN } from '../../../src/api/records/recordKeys';
import { madeRecords } from '../../../src/records/madeRecords';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';
import { webTest as test } from '../../../src/web/webTest';
import { putEmployeeOnShift } from '../plans/planSteps';
import { emptyPlanOfRun, forgetShiftWhenGone, planValues, SHIFTS_WITH_EMPLOYEE, shiftOfRun } from './workPlanSetUp';

/**
 * The delete cases of Java web/webTimeTables (tests.web.workingHours.TimeTablesTests deletePlan,
 * verifyThatTheAuthorizedUserCanNotDeleteShiftLinkedWithEmployees, verifyThatTheAuthorizedUserCanDeleteShiftNotLinkedWithEmployees),
 * step by step on the run's plan and shift (made by API first when the case runs alone).
 */
const PLAN_HAS_SHIFTS = 'يوجد مناوبات مرتبطة بهذه الخطة';
const PLAN_DELETED = 'تم حذف الخطة بنجاح';
const SHIFT_HAS_EMPLOYEES = 'لا يمكن حذف مناوبة مرتبطة بموظفين او ادارات';
const SHIFT_EDITED = 'تم تعديل المناوبة بنجاح';
const SHIFT_DELETED = 'تم حذف المناوبة بنجاح';
const CURRENT_AND_FUTURE = 'حذف المناوبة الحاليه و المستقبليه';

/** Java deletePlan (planDeleted = false): the plan still has a shift - the app refuses and the plan stays */
test('testVerifyThatAPlanWithShiftsCannotBeDeleted', async ({ page }) => {
  const s = await shiftOfRun();
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickPlanMenuItem(s.plan, 'حذف');
  await plans.confirmDialog();

  checkEquals('Delete plan · toast (refused: it has shifts)', await plans.toastShows(PLAN_HAS_SHIFTS), PLAN_HAS_SHIFTS);
  checkTrue('Delete plan · the plan is still in the list', await plans.planShown(s.plan));
});

/** Java verifyThatTheAuthorizedUserCanNotDeleteShiftLinkedWithEmployees: the shift's details, delete, current and future, OK */
test('testVerifyThatAShiftWithEmployeesCannotBeDeleted', async ({ page }) => {
  const s = await shiftOfRun();
  const day = planValues().day;
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  if (!s.employeeOn) { // the case's own set-up: only the add-shift case saves the shift with the employee (run 907)
    await putEmployeeOnShift(plans, day, s.shift);
    runRecords.keep(SHIFTS_WITH_EMPLOYEE, s.shift);
  }
  await plans.openShiftDetails(day, s.shift);
  await plans.clickDeleteIcon();
  await plans.chooseDeleteScope(CURRENT_AND_FUTURE);
  await plans.confirmDialog();

  checkEquals('Delete shift · toast (refused: employees on it)', await plans.toastShows(SHIFT_HAS_EMPLOYEES), SHIFT_HAS_EMPLOYEES);
  checkTrue('Calendar · the shift is still shown', await plans.shiftShown(day, s.shift));
});

/** Java verifyThatTheAuthorizedUserCanDeleteShiftNotLinkedWithEmployees: edit, employees taken off, save, OK; then delete */
test('testVerifyThatAShiftWithoutEmployeesCanBeDeleted', async ({ page }) => {
  const s = await shiftOfRun();
  const day = planValues().day;
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.openShiftDetails(day, s.shift);
  await plans.clickEditIcon();
  await plans.removeEmployee();
  await plans.saveShift();
  await plans.confirmEditQuestion();
  checkEquals('Edit shift · toast (employees removed)', await plans.toastShows(SHIFT_EDITED), SHIFT_EDITED);
  runRecords.forget(SHIFTS_WITH_EMPLOYEE, s.shift);
  await plans.toastGone();

  await plans.clickDeleteIcon();
  await plans.chooseDeleteScope(CURRENT_AND_FUTURE);
  await plans.confirmDialog();
  checkEquals('Delete shift · toast', await plans.toastShows(SHIFT_DELETED), SHIFT_DELETED);
  const gone = await plans.shiftGone(day, s.shift);
  checkTrue('Calendar · the shift is gone', gone);
  forgetShiftWhenGone(s.shift, gone);
});

/** Java deletePlan (planDeleted = true, the suite's "Clean up - delete plan" block): the plan without shifts is deleted */
test('testVerifyThatTheAdminCanDeleteTheWorkPlan', async ({ page }) => {
  const plan = await emptyPlanOfRun(); // set-up: this run's leftover shifts deleted by API first
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickPlanMenuItem(plan.name, 'حذف');
  await plans.confirmDialog();

  checkEquals('Delete plan · toast', await plans.toastShows(PLAN_DELETED), PLAN_DELETED);
  checkTrue('Delete plan · the plan is gone from the list', await plans.planGone(plan.name));
  madeRecords.deletedByTest(WORK_PLAN, plan.name); // run 1033: the clean-up reads it back, never claims it gone
});
