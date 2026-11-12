import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { MADE_PLANS } from '../../../src/api/services/workPlanApi';
import { fullName } from '../../../src/data/newEmployee';
import { time24 } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals } from '../../../src/report/checks';
import { refusedPage } from '../../../src/web/pageFacts';
import { ShiftEmployeePicker } from '../../../src/web/pages/ShiftEmployeePicker';
import { WorkPlanCalendar } from '../../../src/web/pages/WorkPlanCalendar';
import { WorkPlanColours } from '../../../src/web/pages/WorkPlanColours';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';
import { webTest as test } from '../../../src/web/webTest';
import { MADE_SHIFTS, planOfRun, planValues, SHIFTS_WITH_EMPLOYEE, shiftOfRun } from './workPlanSetUp';

/**
 * Work plans - the TS twin of tests.web.workingHours.TimeTablesTests (Availo suite web/webTimeTables): every case works
 * on this run's own plan, shift and employee only; what a case needs and the run has not made yet is made by API first.
 */
const PLAN_ADDED = 'تم إضافة خطة عمل بنجاح';
const PLAN_EDITED = 'تم تعديل الخطة بنجاح';
const SHIFT_ADDED = 'تم إضافة المناوبة بنجاح';
const NO_SHIFT = 'nothing - the list stayed empty';

/** what a check saw: the wanted value when it is among the shown ones, else all it showed (none = the calendar was empty) */
function seenAmong(shown: string[], want: string): string {
  return shown.includes(want) ? want : shown.join(', ') || NO_SHIFT;
}

/** passes only when the app really opened signed in (the page fixture signs in once per run and proves it) */
test('logInProgrammatically', async ({ page }) => {
  const opened = refusedPage(page.url()) ? 'the sign-in page' : 'the app, signed in';
  checkEquals('Sign-in · what the app opened', opened, 'the app, signed in');
});

test('testVerifyThatTheAdminCanAddANewWorkPlan', async ({ page }) => {
  const v = planValues();
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickAddPlan();
  await plans.enterPlanName(v.plan);
  await plans.selectCountry(v.country);
  await plans.turnOnEveryDay();
  await plans.clickSave();
  runRecords.keep(MADE_PLANS, v.plan); // the clean-up deletes it

  checkEquals('Add plan · toast', await plans.toastShows(PLAN_ADDED), PLAN_ADDED);
  checkEquals('Add plan · the new plan is in the plan list', seenAmong(await new WorkPlanCalendar(page).planNames(v.plan), v.plan), v.plan);
});

test('testVerifyThatTheAdminCanEditTheWorkPlan', async ({ page }) => {
  const plan = await planOfRun();
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans(); // Java editPlanSuccessfully: goHome, then the plan (a plan made by API is in the page it loads)
  await plans.clickPlanMenuItem(plan.name, 'تعديل');
  await plans.setDay('سبت', false);
  await plans.setDay('جمعة', false);
  await plans.clickSave();

  checkEquals('Edit plan · toast', await plans.toastShows(PLAN_EDITED), PLAN_EDITED);
});

test('testVerifyThatTheAdminCanAddANewRegularShiftForTheEmployee', async ({ page }) => {
  const plan = await planOfRun();
  const employee = await approvedEmployeeOfRun();
  const v = planValues();
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  await plans.clickAddShift();
  await plans.enterShiftTitle(v.shift);
  await plans.selectShiftPlan(plan.name);
  checkEquals('Shift form · the start date is tomorrow', String(await plans.startDayShown()), v.formDay); // Java: tomorrow
  await plans.chooseTime('بداية الدوام', param('shift_start', '10:00 am'));
  await plans.chooseTime('نهاية الدوام', param('shift_end', '05:00 pm'));
  await plans.selectRepeat('daily');
  await plans.chooseTime('الحد الأقصى لتسجيل الخروج', param('max_check_out', '08:00 pm'));
  await new ShiftEmployeePicker(page).addEmployee(employee.jobNumber, fullName(employee));
  await plans.saveShift();
  runRecords.keep(MADE_SHIFTS, v.shift);
  runRecords.keep(SHIFTS_WITH_EMPLOYEE, v.shift);

  checkEquals('Add shift · toast', await plans.toastShows(SHIFT_ADDED), SHIFT_ADDED);
  checkEquals('Calendar · the new shift shows on the next working day', seenAmong(await new WorkPlanCalendar(page).titlesOn(v.day, v.shift), v.shift), v.shift);
  await plans.openShiftDetails(v.day, v.shift);
  checkEquals('Shift details · start', await plans.detail('بداية الدوام'), time24(param('shift_start', '10:00 am')));
  checkEquals('Shift details · end', await plans.detail('نهاية الدوام'), time24(param('shift_end', '05:00 pm')));
  checkEquals('Shift details · max check-out', await plans.detail('الحد الأقصى لتسجيل الخروج'), time24(param('max_check_out', '08:00 pm')));
  await plans.closeDialog();
});

test('testVerifyThatThePlanFilterShowsOnlyThatPlansShifts', async ({ page }) => {
  const made = await shiftOfRun();
  const day = planValues().day;
  const plans = new WorkPlansPage(page);
  await plans.openWorkPlans();
  const colours = new WorkPlanColours(page);
  const colour = await colours.colourOfPlan(made.plan);
  await plans.filterByPlan(made.plan);

  // never a fixed count others can change: every shift shown matches the filter, and this run's shift is among them
  checkEquals("Plan filter · the colours of the shifts shown (only the filtered plan's)", (await colours.coloursShown(colour)).join(', ') || NO_SHIFT, colour);
  checkEquals('Plan filter · the shift this run made is among them', seenAmong(await new WorkPlanCalendar(page).titlesOn(day, made.shift), made.shift), made.shift);
});
