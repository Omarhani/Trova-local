import { accountClock } from '../../data/appClock';
import { dayOf, workDayOf } from '../../data/workPlanValues';
import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { listOf, Row } from '../rows';
import { shiftWithoutEmployees } from './shiftWithoutEmployees';

const CURRENT_AND_FUTURE = 2;

/**
 * the day a "current and future" delete starts from: the shift's own start day (run 918: a shift made on Thursday
 * starts Friday while the calendar shows it from Sunday - deleting from Sunday only moved its end and left it linked);
 * never before tomorrow; the next working day when the app gives no start day
 */
export function shiftDeleteDay(startDate: unknown, from: Date = accountClock.wallNow()): string {
  const start = /^\d{4}-\d{2}-\d{2}/.exec(String(startDate ?? ''))?.[0];
  if (!start) return workDayOf('tomorrow', from);
  const tomorrow = dayOf('tomorrow', from);
  return start < tomorrow ? tomorrow : start;
}

/**
 * Clean-up of a work plan this run made, with every shift in it (Java WorkPlanApi.deletePlanLeftByThisRun): a shift
 * with employees cannot be deleted, so each shift is first saved with nobody on it, then deleted from tomorrow on,
 * then the plan. Bodies are the portal's own.
 */
export class WorkPlanCleanUpApi {
  constructor(private readonly admin: AppApi) {}

  /** the plan's row (ID, Name, WeeklyDays) of exactly this name; undefined when there is none */
  async plan(name: string): Promise<Row | undefined> {
    const answer = ok(await this.admin.post(this.path('WorkPlan/GetAllWorkPlans'), { pageSize: 0, data: {} }), 'WorkPlan/GetAllWorkPlans');
    return listOf(answer).find((p) => p.Name === name);
  }

  /** deletes the plan and its shifts; nothing to do when it is not there */
  async deletePlanWithShifts(name: string): Promise<void> {
    const plan = await this.plan(name);
    if (!plan) return;
    await this.deleteShifts(plan, () => true);
    const said = appAnswer(await this.admin.post(this.path('WorkPlan/DeleteWorkPlan'), { data: String(plan.ID) }));
    if (!said.ok) throw new Error(`The app refused to delete the plan ${name}: ${said.message}`);
  }

  /**
   * deletes only the shifts of these titles (the ones this run made) from the plan, which stays - run 893 case 542: a
   * blocked earlier case left its shift, so the delete-plan case met "the plan still has shifts"
   */
  async deleteShiftsOf(planName: string, titles: string[]): Promise<void> {
    const plan = titles.length === 0 ? undefined : await this.plan(planName);
    if (plan) await this.deleteShifts(plan, (title) => titles.includes(title));
  }

  /**
   * deletes every shift of the plan, which stays - run 918: the run had already dropped a shift from its records that
   * the app had not deleted, so the delete-plan case met "the plan still has shifts"
   */
  async deleteAllShiftsOf(planName: string): Promise<void> {
    const plan = await this.plan(planName);
    if (plan) await this.deleteShifts(plan, () => true);
  }

  /** each chosen shift saved with nobody on it, then deleted from its own start day on (current and future) */
  private async deleteShifts(plan: Row, chosen: (title: string) => boolean): Promise<void> {
    const planId = String(plan.ID);
    for (const shiftId of await this.shiftIds(planId)) {
      const viewed = await this.view(shiftId, workDayOf('tomorrow'));
      if (!chosen(String(viewed.Name ?? ''))) continue;
      const day = shiftDeleteDay(viewed.StartDate);
      const body = shiftWithoutEmployees(viewed, { shiftId, planId, weeklyDays: Number(plan.WeeklyDays ?? 127), day });
      ok(await this.admin.post(this.path('WorkPlanShift/UpdateWorkPlanShift'), { data: body }), 'WorkPlanShift/UpdateWorkPlanShift');
      ok(await this.admin.post(this.path('WorkPlanShift/DeleteWorkPlanShift'),
        { data: { ID: shiftId, TypeOfDelete: CURRENT_AND_FUTURE, DeletedDate: body.StartDate } }), 'WorkPlanShift/DeleteWorkPlanShift');
    }
  }

  /** the ids of the plan's shifts from today to 31 days on */
  private async shiftIds(planId: string): Promise<string[]> {
    const from = dayOf('', accountClock.wallAt(Date.now() - 86_400_000));
    const to = dayOf('', accountClock.wallAt(Date.now() + 31 * 86_400_000));
    const data = { DepartmentList: [], search_type: 'shift', sDate: from, eDate: to, EmployeeList: [], ShiftName: '',
                   HolidayName: '', WorkPlanIds: [planId] };
    const answer = ok(await this.admin.post(this.path('WorkPlan/GetAllShiftsByWorkPlan'), { data }), 'WorkPlan/GetAllShiftsByWorkPlan');
    const rows = (answer as { Data?: Row[] } | null)?.Data ?? [];
    const shifts = rows.filter((r) => r.ItemType === undefined || r.ItemType === null || Number(r.ItemType) === 1);
    return [...new Set(shifts.map((r) => String(r.ID)))];
  }

  private async view(shiftId: string, day: string): Promise<Row> {
    const [y, m, d] = day.split('-').map(Number);
    const answer = ok(await this.admin.post(this.path('WorkPlanShift/ViewWorkPlanShift'), { data: { Id: shiftId, Date: `${m}/${d}/${y}` } }),
      'WorkPlanShift/ViewWorkPlanShift');
    return ((answer as { Data?: Row } | null)?.Data) ?? {};
  }

  private path(call: string): string {
    return this.admin.underRoot('api', call);
  }
}
