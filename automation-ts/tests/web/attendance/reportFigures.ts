import type { ReportFigures } from '../../../src/web/pages/AttendanceReportPage';
import { param } from '../../../src/run/blockParams';
import { checkEquals } from '../../../src/report/checks';

/** the report's figures by their check line names (Java UserWorkReportPage getters) */
const LABELS: Record<keyof ReportFigures, string> = {
  checkIn: 'check in time',
  checkOut: 'check out time',
  actualHours: 'actual working hours',
  lateArrival: 'late arrival',
  earlyArrival: 'early arrival',
  shortage: 'shortage of attendance',
  earlyCheckOut: 'early check out',
  overtime: 'overtime',
};

/**
 * What the report of the day should show, from the block's parameters (Java AttendanceCalculationTests / FullHybridCycle
 * names): "HH:mm" each; a figure left empty is not checked (Java: "leave a parameter empty and that column is skipped").
 */
export function reportFiguresExpected(): ReportFigures {
  return {
    checkIn: param('attendance_time', '09:00'),
    checkOut: param('cancellation_time', '18:00'),
    actualHours: param('actual_working_hours', ''),
    lateArrival: param('late_arrival', ''),
    earlyArrival: param('early_arrival', ''),
    shortage: param('shortage_of_attendance', ''),
    earlyCheckOut: param('early_check_out', ''),
    overtime: param('overtime', ''),
  };
}

/** one check line per figure the block asks for: expected (the block) / seen (the report) */
export function checkReportFigures(seen: ReportFigures, expected: ReportFigures): void {
  for (const key of Object.keys(LABELS) as Array<keyof ReportFigures>) {
    if (expected[key] !== '') checkEquals(`Report · ${LABELS[key]}`, seen[key], expected[key]);
  }
}
