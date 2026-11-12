import { dayPlus } from './overtimeDays';

/** the day the data word means: "tomorrow" (also empty) or a date (yyyy-MM-dd) - WorkPlanApi.day */
export function dayOf(word: string, from: Date = new Date()): string {
  const w = word.trim();
  return w === '' || w.toLowerCase() === 'tomorrow' ? dayPlus(1, from) : w;
}

/** the plan's week off: Friday and Saturday (getDay 5, 6) - a shift is saved with working days only */
const DAYS_OFF = [5, 6];

/** like dayOf, but "tomorrow" (also empty) is the next working day of the plan - run 893: on Thursday "tomorrow" had no shift */
export function workDayOf(word: string, from: Date = new Date()): string {
  const w = word.trim();
  if (w !== '' && w.toLowerCase() !== 'tomorrow') return w;
  let ahead = 1;
  while (DAYS_OFF.includes(new Date(from.getFullYear(), from.getMonth(), from.getDate() + ahead).getDay())) ahead += 1;
  return dayPlus(ahead, from);
}

function hourMinute(text: string): { hour: number; minute: number; pm: boolean } {
  const t = text.trim().toLowerCase();
  const [h, m] = t.replace(/[a-z\s]/g, '').split(':');
  return { hour: Number.parseInt(h, 10), minute: m === undefined ? 0 : Number.parseInt(m, 10), pm: t.endsWith('pm') };
}

/** "10:00 am" / "05:00 pm" / "6 pm" -> "10:00" / "17:00" / "18:00" */
export function time24(text: string): string {
  const { hour, minute, pm } = hourMinute(text);
  return `${String((hour % 12) + (pm ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** yyyy-MM-dd -> MM/dd/yyyy (the shift list's filter) */
export function usDate(day: string): string {
  const [y, m, d] = day.split('-');
  return `${m}/${d}/${y}`;
}

/** the form's start date "9/11/2026" (day/month/year, digits and slashes only) as yyyy-MM-dd; undefined when not a date */
export function dayShown(text: string): string | undefined {
  const p = text.replace(/[^0-9/]/g, '').split('/');
  if (p.length !== 3 || p.some((x) => x === '')) return undefined;
  const [d, m, y] = p.map((x) => Number.parseInt(x, 10));
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** what to press on the clock face for a time, and what the field shows after ("5:00 pm") */
export interface Clock {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  shows: string;
}

export function clockOf(time: string): Clock {
  const { hour, minute, pm } = hourMinute(time);
  const h = String(hour === 0 ? 12 : hour > 12 ? hour - 12 : hour);
  const period = pm ? 'PM' : 'AM';
  return { hour: h, minute: minute === 0 ? '00' : String(minute), period, shows: `${h}:${String(minute).padStart(2, '0')} ${period.toLowerCase()}` };
}
