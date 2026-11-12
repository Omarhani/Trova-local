import { adminLogin } from '../../../src/api/flows/employeeValues';
import { AppApi } from '../../../src/api/appApi';
import { MADE_PLANS, WorkPlanApi } from '../../../src/api/services/workPlanApi';
import { WorkPlanCleanUpApi } from '../../../src/api/services/workPlanCleanUpApi';
import { dayOf, workDayOf } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { runRecords } from '../../../src/run/runRecords';

/** the run's shift titles (the filter case looks for its own shift) */
export const MADE_SHIFTS = 'work_plan_shift_titles';

/** the run's shifts that have the run's employee on them (the add-shift case saves it with one; API-made ones have none) */
export const SHIFTS_WITH_EMPLOYEE = 'work_plan_shifts_with_employee';

/**
 * the plan and shift values of the Java suite (webTimeTables): this run's own plan and shift, a new one every run.
 * formDay: the start date the shift form shows by itself (tomorrow, as Java checks); day: the first day the calendar
 * shows the shift (the plan's next working day - run 907: on Thursday the form says Friday, the calendar Sunday)
 */
export function planValues(from: Date = new Date()): { plan: string; country: string; shift: string; formDay: string; day: string } {
  return {
    plan: param('plan_name', 'Omar WebPlan {run}'),
    country: param('plan_country', 'مصر'),
    shift: param('shift_title', 'Omar WebShift {run}'),
    formDay: dayOf('tomorrow', from),
    day: workDayOf('tomorrow', from), // the shift is saved with working days only (run 893)
  };
}

async function plansApi(): Promise<WorkPlanApi> {
  return new WorkPlanApi(await AppApi.signedInAs(adminLogin(), 'web'));
}

/** the plan this run made; else one made now by API (the case's runnable set-up) - true when made now */
export async function planOfRun(): Promise<{ name: string; madeNow: boolean }> {
  const made = runRecords.newestFirst(MADE_PLANS)[0];
  if (made) return { name: made, madeNow: false };
  const v = planValues();
  await (await plansApi()).addPlan(v.plan, v.country); // kept for the clean-up by addPlan
  return { name: v.plan, madeNow: true };
}

/**
 * the plan and shift this run made; else a daily shift (10:00-17:00) in the run's plan made now by API.
 * employeeOn: the run's employee is on the shift (run 907: a shift made by API in an earlier case has none)
 */
export async function shiftOfRun(): Promise<{ plan: string; shift: string; employeeOn: boolean }> {
  const plan = await planOfRun();
  const shift = runRecords.newestFirst(MADE_SHIFTS)[0];
  if (shift) return { plan: plan.name, shift, employeeOn: runRecords.newestFirst(SHIFTS_WITH_EMPLOYEE).includes(shift) };
  const v = planValues();
  const api = await plansApi();
  const planId = await api.planId(plan.name);
  if (!planId) throw new Error(`Set-up: the plan ${plan.name} is not there`);
  const added = await api.addShift({ planId, title: v.shift, start: v.day, startTime: '10:00 am', endTime: '05:00 pm', maxCheckout: '08:00 pm' });
  if (!added.ok) throw new Error(`Set-up: the app refused the shift ${v.shift}: ${added.message}`);
  runRecords.keep(MADE_SHIFTS, v.shift);
  return { plan: plan.name, shift: v.shift, employeeOn: false };
}

/** every shift of the plan deleted by API, the plan stays */
async function deleteAllShiftsOf(planName: string): Promise<void> {
  await new WorkPlanCleanUpApi(await AppApi.signedInAs(adminLogin(), 'web')).deleteAllShiftsOf(planName);
}

/**
 * the run's plan emptied by API first (run 893 case 542): a blocked earlier delete case is never turned into a false
 * Failed of the delete-plan case. Run 918: every shift of the run's own plan, not only the ones still on record - the
 * delete-shift case had dropped a shift from the records that the app had kept
 */
export async function emptyPlanOfRun(
  emptyPlan: (planName: string) => Promise<void> = deleteAllShiftsOf,
): Promise<{ name: string; madeNow: boolean }> {
  const plan = await planOfRun();
  if (plan.madeNow) return plan;
  await emptyPlan(plan.name);
  runRecords.newestFirst(MADE_SHIFTS).forEach((title) => runRecords.forget(MADE_SHIFTS, title));
  runRecords.newestFirst(SHIFTS_WITH_EMPLOYEE).forEach((title) => runRecords.forget(SHIFTS_WITH_EMPLOYEE, title));
  return plan;
}

/** the deleted shift leaves the run's records only once the calendar shows it gone (run 918 case 541) */
export function forgetShiftWhenGone(title: string, gone: boolean): void {
  if (gone) runRecords.forget(MADE_SHIFTS, title);
}
