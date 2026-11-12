import { expect, test } from '@playwright/test';
import { AppApi } from '../../src/api/appApi';
import { endOfDayUtc } from '../../src/api/services/shiftWithoutEmployees';
import { WorkPlanCleanUpApi } from '../../src/api/services/workPlanCleanUpApi';
import { dayOf, workDayOf } from '../../src/data/workPlanValues';

/** a fake app with one plan and two shifts in it: "Run Shift" (this run's) and "Other Shift"; the calls it got */
function fakeApp(startDate?: unknown) {
  const calls: { call: string; body: unknown }[] = [];
  const names: Record<string, string> = { s1: 'Run Shift', s2: 'Other Shift' };
  const answers: Record<string, (body: Record<string, unknown>) => unknown> = {
    'WorkPlan/GetAllWorkPlans': () => ({ Data: { List: [{ ID: 7, Name: 'Run Plan', WeeklyDays: 31 }] } }),
    'WorkPlan/GetAllShiftsByWorkPlan': () => ({ Data: [{ ID: 's1', ItemType: 1 }, { ID: 's2', ItemType: 1 }] }),
    'WorkPlanShift/ViewWorkPlanShift': (b) => ({ Data: { Name: names[String((b.data as Record<string, unknown>).Id)],
      ShiftStartTime: '10:00:00', ShiftEndTime: '17:00:00', StartDate: startDate } }),
  };
  const api = {
    underRoot: (_root: string, call: string) => call,
    post: async (call: string, body: Record<string, unknown>) => {
      calls.push({ call, body });
      return { status: 200, text: JSON.stringify((answers[call] ?? (() => ({ Result: true })))(body)) };
    },
  } as unknown as AppApi;
  return { api, calls };
}

const deleted = (calls: { call: string; body: unknown }[]) => calls.filter((c) => c.call === 'WorkPlanShift/DeleteWorkPlanShift')
  .map((c) => String(((c.body as Record<string, unknown>).data as Record<string, unknown>).ID));

test('the delete-plan set-up takes off and deletes only the shifts this run made, the plan stays (run 893 case 542)', async () => {
  const app = fakeApp();
  await new WorkPlanCleanUpApi(app.api).deleteShiftsOf('Run Plan', ['Run Shift']);
  expect(deleted(app.calls)).toEqual(['s1']);
  expect(app.calls.filter((c) => c.call === 'WorkPlanShift/UpdateWorkPlanShift')).toHaveLength(1);
  expect(app.calls.some((c) => c.call === 'WorkPlan/DeleteWorkPlan')).toBe(false);
});

test('no shift left by the run: nothing is deleted', async () => {
  const app = fakeApp();
  await new WorkPlanCleanUpApi(app.api).deleteShiftsOf('Run Plan', []);
  expect(deleted(app.calls)).toEqual([]);
});

test('a plan that is not there: nothing is deleted', async () => {
  const app = fakeApp();
  await new WorkPlanCleanUpApi(app.api).deleteShiftsOf('Gone Plan', ['Run Shift']);
  expect(deleted(app.calls)).toEqual([]);
});

/** the fake app whose shifts all start on startDate (as ViewWorkPlanShift tells) - the delete day the calls used */
async function deleteDaysWhenShiftStarts(startDate: unknown): Promise<string[]> {
  const app = fakeApp(startDate);
  await new WorkPlanCleanUpApi(app.api).deleteShiftsOf('Run Plan', ['Run Shift']);
  return app.calls.filter((c) => c.call === 'WorkPlanShift/DeleteWorkPlanShift')
    .map((c) => String(((c.body as Record<string, unknown>).data as Record<string, unknown>).DeletedDate));
}

test('the shift is deleted from its own start day, not the next working day (run 918: starts Fri, calendar from Sun)', async () => {
  const startsTomorrow = new Date(Date.now() + 86_400_000);
  const day = `${startsTomorrow.getFullYear()}-${String(startsTomorrow.getMonth() + 1).padStart(2, '0')}-${String(startsTomorrow.getDate()).padStart(2, '0')}`;
  expect(await deleteDaysWhenShiftStarts(`${day}T00:00:00`)).toEqual([endOfDayUtc(day)]);
});

test('a shift that starts later is deleted from its start day', async () => {
  expect(await deleteDaysWhenShiftStarts('2099-03-04T00:00:00')).toEqual([endOfDayUtc('2099-03-04')]);
});

test('a shift that started before tomorrow is deleted from tomorrow (past days cannot be deleted)', async () => {
  expect(await deleteDaysWhenShiftStarts('2020-01-05T00:00:00')).toEqual([endOfDayUtc(dayOf('tomorrow'))]);
});

test('no start date in the view: the next working day as before', async () => {
  expect(await deleteDaysWhenShiftStarts(undefined)).toEqual([endOfDayUtc(workDayOf('tomorrow'))]);
});

test('every shift of the plan is deleted and the plan stays (run 918: the run had lost the shift from its records)', async () => {
  const app = fakeApp();
  await new WorkPlanCleanUpApi(app.api).deleteAllShiftsOf('Run Plan');
  expect(deleted(app.calls)).toEqual(['s1', 's2']);
  expect(app.calls.some((c) => c.call === 'WorkPlan/DeleteWorkPlan')).toBe(false);
});
