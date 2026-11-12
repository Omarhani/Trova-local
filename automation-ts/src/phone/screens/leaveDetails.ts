/** what the request's details screen shows; dates dd/MM/yyyy as the screen writes them */
export interface ShownLeaveDetails {
  id: string;
  type: string;
  status: string;
  start: string;
  end: string;
  submitted: string;
  duration: string;
  notes: string;
}

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const DURATION = /^\d+\s*(day|days|يوم|أيام|ايام)(\s|$)/i;

/** the details card's labels in the app's two languages (the app's own English and Arabic texts, read from its package 2026-11-11) */
const LABELS = {
  start: ['Start', 'البداية'],
  end: ['End', 'النهاية'],
  submitted: ['Submission Date', 'Submission date', 'تاريخ التقديم'],
  duration: ['Request Duration', 'Request duration', 'مدة الطلب'],
  notes: ['Notes', 'ملاحظات'],
} as const;

/** run 720: the Arabic app writes its numbers in Arabic digits (١٦/١١/٢٠٢٦) - read as 16/11/2026 */
export function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

const linesOf = (desc: string): string[] => latinDigits(desc).split('\n').map((l) => l.trim()).filter(Boolean);

/** run 720: one day, as the card says it - "1 Day" in English, "يوم واحد" in Arabic */
export function isOneDay(duration: string): boolean {
  return /^1(\s|$)/.test(latinDigits(duration.trim())) || /^يوم(\s+واحد)?$/.test(duration.trim());
}

/** the details card: one description of several lines, starting with the request's number, holding its dates */
export function isDetailsCard(desc: string): boolean {
  const d = latinDigits(desc);
  return /\n/.test(d) && /\d{2}\/\d{2}\/\d{4}/.test(d) && /^\d+\n/.test(d);
}

/** the line after the first of these labels; undefined when none of them is on the card */
function after(lines: string[], labels: readonly string[]): string | undefined {
  const at = lines.findIndex((l) => labels.includes(l));
  return at >= 0 && at + 1 < lines.length ? lines[at + 1] : undefined;
}

/**
 * The details card read from its one description ("<id>\nLeave-Sick leave\nStart\n25/09/2026\nEnd\n...\nNotes\n<note>",
 * Java HomeScreen.getLeaveDetails): by its labels where the card has them, else by place - the dates in the card's order
 * (start, submission, end: the app lays Start over Submission Date, then End), the "1 Day" line, the last line as the
 * note. The status is its own element on the screen (status).
 */
export function detailsOf(desc: string, status: string): ShownLeaveDetails {
  const lines = linesOf(desc);
  const dates = lines.filter((l) => DATE.test(l));
  const labelled = after(lines, LABELS.start) !== undefined;
  return {
    id: lines[0] ?? '',
    type: lines[1] ?? '',
    status,
    start: (labelled ? after(lines, LABELS.start) : dates[0]) ?? '',
    end: (labelled ? after(lines, LABELS.end) : dates[2]) ?? '',
    submitted: (labelled ? after(lines, LABELS.submitted) : dates[1]) ?? '',
    duration: after(lines, LABELS.duration) ?? lines.find((l) => DURATION.test(l)) ?? '',
    notes: after(lines, LABELS.notes) ?? (lines.length > 2 ? lines[lines.length - 1] : ''),
  };
}

/** the card is written right to left (Arabic words on it): its icons sit mirrored */
export function rightToLeft(desc: string): boolean {
  return /\p{Script=Arabic}/u.test(desc);
}
