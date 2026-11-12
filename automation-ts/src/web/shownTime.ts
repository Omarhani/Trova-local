import { ClockTime } from './clockTime';

const two = (n: number): string => String(n).padStart(2, '0');

/**
 * A table cell's time as "HH:mm" (24 hours): "09:00", "9:00 AM", "18:00:00", "06:00 م" all read; undefined when the cell
 * holds no time (a date, a name, a type). Spaces the page adds (no-break, right-to-left marks) are left out.
 */
export function shownTime(cell: string): string | undefined {
  const text = cell.replace(/[\s ‎‏]+/g, ' ').trim();
  const withoutSeconds = text.replace(/^(\d{1,2}:\d{2}):\d{2}/, '$1');
  const t = ClockTime.read(withoutSeconds);
  return t && /:/.test(withoutSeconds) ? `${two(t.hour24)}:${two(t.minute)}` : undefined;
}
