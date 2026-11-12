import { appAnswer } from '../appAnswer';
import { AppApi, ok } from '../appApi';
import { time24, usDate } from '../../data/workPlanValues';
import { runRecords } from '../../run/runRecords';

/** run records kind: the names of the plans this run made (the clean-up finds them by name) */
export const MADE_PLANS = 'workPlanNames';
const EGYPT = 11;

type Row = Record<string, unknown>;

/** a daily shift to add: the day it starts (yyyy-MM-dd) and its times in words ("10:00 am") */
export interface ShiftToAdd {
  planId: string;
  title: string;
  start: string;
  startTime: string;
  endTime: string;
  maxCheckout: string;
}

/**
 * Work plans and their shifts by API (web side) - the TS twin of api.services.WorkPlanApi: set-up of a plan / shift,
 * and the clean-up that removes them again. Every call is Trova's known call with its known body.
 */
export class WorkPlanApi {
  constructor(private readonly api: AppApi) {}

  /** adds a plan for every day of the week and keeps its name for the clean-up; its id */
  async addPlan(name: string, country: string): Promise<string> {
    if (country !== 'مصر') throw new Error(`The plan set-up knows only the country مصر (asked for "${country}")`);
    const answer = ok(await this.api.call('POST /WorkPlan/AddWorkPlan', { Name: name, CountryID: EGYPT }), 'WorkPlan/AddWorkPlan') as Row;
    runRecords.keep(MADE_PLANS, name);
    return String(answer?.Data ?? '');
  }

  /** adds a daily shift to the plan; ok = HTTP 2xx (as KnownCall.okOrSkip), else the app's own words */
  async addShift(s: ShiftToAdd): Promise<{ ok: boolean; message: string }> {
    const from = time24(s.startTime);
    const to = time24(s.endTime);
    const answer = await this.api.call('POST /WorkPlanShift/AddWorkPlanShift', {
      Name: s.title, WorkPlanID: s.planId, StartDate: `${s.start}T00:00:00.000Z`, ShiftTime: `${from} - ${to}`,
      ShiftStartTime: from, ShiftEndTime: to, TotalWorkingHours: Number(to.slice(0, 2)) - Number(from.slice(0, 2)),
      MaxCheckout: time24(s.maxCheckout),
    });
    const took = answer.status >= 200 && answer.status < 300;
    return { ok: took, message: took ? '' : appAnswer(answer).message };
  }

  /** the ids of the plan's shifts that run on day (yyyy-MM-dd) */
  async shiftIds(planId: string, day: string): Promise<string[]> {
    const data = { DepartmentList: [], search_type: 'shift', sDate: usDate(day), eDate: usDate(day), EmployeeList: [],
                   ShiftName: '', HolidayName: '', WorkPlanIds: [planId] };
    const answer = ok(await this.api.call('POST /WorkPlan/GetAllShiftsByWorkPlan', { data }), 'WorkPlan/GetAllShiftsByWorkPlan') as { Data?: Row[] };
    return (Array.isArray(answer?.Data) ? answer.Data : []).filter((r) => String(r.WorkPlanId) === planId).map((r) => String(r.ID));
  }

  /** the id of the plan with this exact name; undefined when there is none */
  async planId(name: string): Promise<string | undefined> {
    const answer = ok(await this.api.call('POST /WorkPlan/GetAllWorkPlans', {}), 'WorkPlan/GetAllWorkPlans') as { Data?: { List?: Row[] } };
    const row = (answer?.Data?.List ?? []).find((r) => r.Name === name);
    return row === undefined ? undefined : String(row.ID);
  }

  /** deletes the shift from its first day on (current and future ones) */
  async deleteShift(shiftId: string, start: string): Promise<void> {
    ok(await this.api.call('POST /WorkPlanShift/DeleteWorkPlanShift', { ID: shiftId, TypeOfDelete: '2', DeletedDate: `${start}T21:59:00.000Z` }),
      'WorkPlanShift/DeleteWorkPlanShift');
  }

  /** deletes the plan; the app's own words when it refuses */
  async deletePlan(planId: string): Promise<void> {
    const said = appAnswer(await this.api.call('POST /WorkPlan/DeleteWorkPlan', { data: planId }));
    if (!said.ok) throw new Error(`WorkPlan/DeleteWorkPlan: ${said.message || 'the app refused'}`);
  }
}
