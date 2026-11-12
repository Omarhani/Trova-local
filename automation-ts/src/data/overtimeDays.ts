import { accountClock } from './appClock';

/** the date days after from, yyyy-MM-dd - from is the app's own wall time (its account clock), never the computer's */
export function dayPlus(days: number, from: Date = accountClock.wallNow()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
