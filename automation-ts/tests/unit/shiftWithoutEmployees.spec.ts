import { expect, test } from '@playwright/test';
import { endOfDayUtc, shiftWithoutEmployees } from '../../src/api/services/shiftWithoutEmployees';

const VIEWED = { Name: 'Omar WebShift', ShiftStartTime: '10:00:00', ShiftEndTime: '17:00:00', MaxCheckout: '20:00:00' };

test('the end of a day in Riyadh time (UTC+3) as the app sends it', () => {
  expect(endOfDayUtc('2026-11-11')).toBe('2026-11-11T20:59:00Z');
});

test('the viewed shift goes back with its own name and times and no employees or departments', () => {
  const body = shiftWithoutEmployees(VIEWED, { shiftId: 's-1', planId: 'p-1', weeklyDays: 127, day: '2026-11-11' });
  expect(body).toMatchObject({
    ID: 's-1', Name: 'Omar WebShift', WorkPlanID: 'p-1', WeeklyDays: 127, OccurranceType: 1, Type: 1,
    ShiftStartTime: '10:00', ShiftEndTime: '17:00', ShiftTime: '10:00 - 17:00', MaxCheckout: '20:00',
    TotalWorkingHours: 7, EndNextDay: false, StartDate: '2026-11-11T20:59:00Z',
    WorkPlanShiftEmployees: [], WorkPlanShiftDepartments: [],
  });
});

test('a shift ending after midnight ends the next day and counts its hours across it', () => {
  const body = shiftWithoutEmployees({ ...VIEWED, ShiftStartTime: '22:00', ShiftEndTime: '06:30' },
    { shiftId: 's', planId: 'p', weeklyDays: 1, day: '2026-11-11' });
  expect(body.EndNextDay).toBe(true);
  expect(body.TotalWorkingHours).toBe(8.5);
});

test('no max check-out on the shift: 23:00, as the Java clean-up sends', () => {
  const body = shiftWithoutEmployees({ ...VIEWED, MaxCheckout: null }, { shiftId: 's', planId: 'p', weeklyDays: 1, day: '2026-11-11' });
  expect(body.MaxCheckout).toBe('23:00');
});
