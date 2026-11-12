/** one request of the employee as its own list gives it (Leaves/AllLeaves): its first and last day */
export interface LeaveSpan {
  FromDate: string;
  ToDate: string;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** a day as yyyy-MM-dd, the Date's own calendar day (the app's day when the Date is the app clock's wall time) */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** a day as dd/MM/yyyy (the request's details screen on the phone) */
export function dmy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "Fri,Sat" / "Friday, Saturday" -> [5, 6] (Date.getDay numbers); empty = no weekend; an unknown word stops */
export function weekendOf(text: string): number[] {
  const words = text.split(',').map((w) => w.trim()).filter(Boolean);
  return words.map((word) => {
    const w = word.toLowerCase();
    const day = DAYS.findIndex((d) => d === w || (w.length >= 3 && d.startsWith(w)));
    if (day < 0) throw new Error(`"${word}" is not a day name - write the weekend like "Fri,Sat"`);
    return day;
  });
}

/**
 * The leave day of the case (Omar 2026-11-11: a day the app accepts, never a fixed date): the first day after today
 * that is not a weekend day and not inside any request the employee already has (from - to, both ends).
 */
export function freeLeaveDay(taken: LeaveSpan[], today: Date, weekend: number[], maxDays = 62): Date {
  const spans = taken.map((t) => [t.FromDate.slice(0, 10), t.ToDate.slice(0, 10)]);
  for (let ahead = 1; ahead <= maxDays; ahead++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
    const key = ymd(day);
    if (weekend.includes(day.getDay())) continue;
    if (spans.some(([from, to]) => key >= from && key <= to)) continue;
    return day;
  }
  throw new Error(`No free working day for a leave in the next ${maxDays} days - the employee has requests on all of them`);
}

/** how many months the picker moves on from today's month to the day's (it opens on today's month) */
export function monthsAhead(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
}
