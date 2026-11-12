import { JsonObject } from '../../trova/json';

/** where the shift goes back: its id, plan, the plan's working days and the day it starts from (yyyy-MM-dd) */
export interface ShiftPlace {
  shiftId: string;
  planId: string;
  weeklyDays: number;
  day: string;
}

/** 23:59 of the day in Riyadh time (UTC+3), as Java's ShiftForm.endOfDayUtc writes it ("2026-11-11T20:59:00Z") */
export function endOfDayUtc(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 20, 59)).toISOString().replace('.000Z', 'Z');
}

function hhmm(time: unknown): string {
  return String(time ?? '').slice(0, 5);
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * The shift as the portal's edit form saves it, with no employee and no department left on it - the clean-up's first
 * step (a shift with employees cannot be deleted). The TS twin of ShiftForm.existing(...).toBody() in
 * WorkPlanApi.deletePlanLeftByThisRun; viewed = the Data of WorkPlanShift/ViewWorkPlanShift.
 */
export function shiftWithoutEmployees(viewed: Record<string, unknown>, at: ShiftPlace): JsonObject {
  const start = hhmm(viewed.ShiftStartTime);
  const end = hhmm(viewed.ShiftEndTime);
  const endNextDay = minutesOf(start) >= minutesOf(end);
  const minutes = minutesOf(end) - minutesOf(start) + (endNextDay ? 24 * 60 : 0);
  return {
    ID: at.shiftId, Name: String(viewed.Name ?? ''), Type: 1, EndNextDay: endNextDay, CheckPeriod: '',
    CheckInStartPeriod: null, CheckOutEndPeriod: null, ShiftTime: `${start} - ${end}`, ShiftStartTime: start,
    ShiftEndTime: end, FlexableTime: '', FlexableStartTime: null, FlexableEndtTime: null, MaxStartTime: null,
    TotalWorkingHours: minutes / 60, DetermineBreakTime: false, BreakShifts: [], BreakTime: '', BreakStartTime: null,
    BreakEndTime: null, MaxStartBreakTime: null, BreakMinutes: 30, OccurranceType: 1, WeeklyDays: at.weeklyDays,
    WorkPlanID: at.planId, WorkPlanShiftEmployees: [], WorkPlanShiftDepartments: [], StartDate: endOfDayUtc(at.day),
    IsCloseAutomatic: false, MaxCheckout: viewed.MaxCheckout ? hhmm(viewed.MaxCheckout) : '23:00',
    CloseAutomaticallyHour: null, CloseAutomaticallyMinutes: null, IsHalfWorkingHours: false, IsNeedApprove: false,
    EarlyAttendanceOption: null, FlexibleCheckOutTime: null, EnableAutoBreakDurationMinutes: false,
    AutoBreakDurationMinutes: 0, CodeId: '',
  };
}
