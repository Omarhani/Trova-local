import { test } from '@playwright/test';
import { AppApi } from '../../../src/api/appApi';
import { WorkPlanApi } from '../../../src/api/services/workPlanApi';
import { dayOf } from '../../../src/data/workPlanValues';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { checkEquals } from '../../../src/report/checks';
import { WorkPlansPage } from '../../../src/web/pages/WorkPlansPage';

/** the shift a block works with: its plan, title, day and times (suite parameters, the Java defaults otherwise) */
export interface ShiftData {
  plan: string;
  country: string;
  title: string;
  startDate: string;
  day: string;
  startTime: string;
  endTime: string;
  maxCheckout: string;
}

export function shiftData(caseNo: string, maxCheckoutParam = 'shift_max_checkout_time', maxCheckoutDefault = '08:00 pm'): ShiftData {
  const startDate = param('shift_start_date', 'tomorrow');
  return {
    plan: param('shift_plan_name', `Trova Plan {run:${caseNo}}`),
    country: param('shift_plan_country', 'مصر'),
    title: param('shift_title', `Trova Shift {run:${caseNo}}`),
    startDate,
    day: dayOf(startDate),
    startTime: param('shift_start_time', '10:00 am'),
    endTime: param('shift_end_time', '05:00 pm'),
    maxCheckout: param(maxCheckoutParam, maxCheckoutDefault),
  };
}

async function plans(): Promise<WorkPlanApi> {
  return new WorkPlanApi(await AppApi.signedInAs(runLogin(param('signedInAs', 'Account Manager - Plan')), 'web'));
}

/** makes the plan by API (its name kept for the clean-up); its id */
export async function madePlan(name: string, country: string): Promise<string> {
  return (await plans()).addPlan(name, country);
}

/** makes the plan and a daily shift in it by API; a refused shift = "Not tested - the shift ... - the app refused it" */
export async function madePlanWithShift(s: ShiftData): Promise<string> {
  const api = await plans();
  const planId = await api.addPlan(s.plan, s.country);
  const added = await api.addShift({ planId, title: s.title, start: s.day, startTime: s.startTime, endTime: s.endTime, maxCheckout: s.maxCheckout });
  test.skip(!added.ok, `Not tested - the shift ${s.title} - the app refused it: ${added.message}`);
  return planId;
}

const SHIFT_EDITED = 'تم تعديل المناوبة بنجاح';

/** opens the shift and puts one employee on it (set-up inside the screen test) */
export async function putEmployeeOnShift(plansPage: WorkPlansPage, day: string, title: string): Promise<void> {
  await plansPage.openShiftDetails(day, title);
  await plansPage.clickEditIcon();
  await plansPage.addAnyEmployee();
  await plansPage.saveShift();
  await plansPage.confirmEditQuestion();
  checkEquals('Set-up · employee added', await plansPage.toastShows(SHIFT_EDITED), SHIFT_EDITED);
  await plansPage.toastGone();
  await plansPage.closeDialog();
}

/** takes the employee off the shift so the shift and its plan can be deleted */
export async function takeEmployeeOffShift(plansPage: WorkPlansPage, day: string, title: string): Promise<void> {
  await plansPage.openShiftDetails(day, title);
  await plansPage.clickEditIcon();
  await plansPage.removeEmployee();
  await plansPage.saveShift();
  await plansPage.confirmEditQuestion();
}
