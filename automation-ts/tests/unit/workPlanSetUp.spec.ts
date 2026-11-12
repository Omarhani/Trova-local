import { expect, test } from '@playwright/test';
import { MADE_PLANS } from '../../src/api/services/workPlanApi';
import { runRecords } from '../../src/run/runRecords';
import { emptyPlanOfRun, forgetShiftWhenGone, MADE_SHIFTS, planValues, SHIFTS_WITH_EMPLOYEE, shiftOfRun } from '../web/workPlans/workPlanSetUp';

const THURSDAY_NOV_12 = new Date(2026, 10, 12);

test('on Thursday the shift form starts tomorrow (Friday), the calendar shows the shift from Sunday (run 907)', () => {
  const v = planValues(THURSDAY_NOV_12);
  expect(v.formDay).toBe('2026-11-13');
  expect(v.day).toBe('2026-11-15');
});

test('on a Monday the form day and the first calendar day are both tomorrow', () => {
  const v = planValues(new Date(2026, 10, 9));
  expect(v.formDay).toBe('2026-11-10');
  expect(v.day).toBe('2026-11-10');
});

/** this test's own plan and shift in the run's records, taken off again after */
async function withOwnShift(employeeOn: boolean, check: (s: Awaited<ReturnType<typeof shiftOfRun>>) => void): Promise<void> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const plan = `Unit Plan ${stamp}`;
  const shift = `Unit Shift ${stamp}`;
  runRecords.keep(MADE_PLANS, plan);
  runRecords.keep(MADE_SHIFTS, shift);
  if (employeeOn) runRecords.keep(SHIFTS_WITH_EMPLOYEE, shift);
  try {
    check(await shiftOfRun());
  } finally {
    runRecords.forget(MADE_PLANS, plan);
    runRecords.forget(MADE_SHIFTS, shift);
    runRecords.forget(SHIFTS_WITH_EMPLOYEE, shift);
  }
}

test('a shift the run made by API has no employee on it, so the refuse-delete case puts one on (run 907)', async () => {
  await withOwnShift(false, (s) => expect(s.employeeOn).toBe(false));
});

test('the shift the add-shift case saved with the employee is known to have the employee on it', async () => {
  await withOwnShift(true, (s) => expect(s.employeeOn).toBe(true));
});

test('the delete-plan set-up empties the run\'s plan even when the run has no shift on record (run 918)', async () => {
  const plan = `Unit Plan ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  runRecords.keep(MADE_PLANS, plan);
  const emptied: string[] = [];
  try {
    const got = await emptyPlanOfRun(async (name) => { emptied.push(name); });
    expect(got.name).toBe(plan);
    expect(emptied).toEqual([plan]);
  } finally {
    runRecords.forget(MADE_PLANS, plan);
  }
});

test('the deleted shift leaves the run\'s records only once the calendar shows it gone (run 918 case 541)', () => {
  const shift = `Unit Shift ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  runRecords.keep(MADE_SHIFTS, shift);
  try {
    forgetShiftWhenGone(shift, false);
    expect(runRecords.newestFirst(MADE_SHIFTS)).toContain(shift);
    forgetShiftWhenGone(shift, true);
    expect(runRecords.newestFirst(MADE_SHIFTS)).not.toContain(shift);
  } finally {
    runRecords.forget(MADE_SHIFTS, shift);
  }
});
