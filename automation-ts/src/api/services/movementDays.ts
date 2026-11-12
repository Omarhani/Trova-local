import { dayAt } from '../../data/appClock';
import { Row } from '../rows';
import { Movement, movementsOf } from './transactionsApi';

const DAY_MS = 86_400_000;

/**
 * Today's movements on the app's own clock (run 1026): the server files a movement on its gate's clock (the row's
 * LocalTimeZone, minutes ahead of UTC), which may be another day than the account's near midnight - so the days around
 * the account's day are read, and a row counts when its own day is today on its own clock.
 */

/** the account's day and the day either side, yyyy-MM-dd - every gate's "today" is one of them */
export function daysAround(nowMs: number, accountOffsetMin: number): string[] {
  return [-1, 0, 1].map((d) => dayAt(nowMs + d * DAY_MS, accountOffsetMin));
}

/** the row's own clock (LocalTimeZone, else GateGroupTimezone); undefined when the server gave none */
export function zoneOf(row: Row): number | undefined {
  const z = row.LocalTimeZone ?? row.GateGroupTimezone;
  return typeof z === 'number' && Number.isFinite(z) ? z : undefined;
}

/** the first clock the rows show, if any (the attendance clock learns it) */
export function zoneOfRows(rows: Row[]): number | undefined {
  return rows.map(zoneOf).find((z) => z !== undefined);
}

/** the rows that are today on their own clock (a row without one: fallbackOffsetMin), each once, as movements */
export function todaysMovements(rows: Row[], nowMs: number, fallbackOffsetMin: number): Movement[] {
  const seen = new Set<string>();
  const today = rows.filter((r) => {
    const key = String(r.ID ?? JSON.stringify(r));
    if (seen.has(key)) return false;
    seen.add(key);
    return String(r.CreateDate ?? '').slice(0, 10) === dayAt(nowMs, zoneOf(r) ?? fallbackOffsetMin);
  });
  return movementsOf(today);
}

/** the moment a row was made: its CreateDate is its own wall time on its own clock; undefined without both */
function instantOf(row: Row): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/.exec(String(row.CreateDate ?? ''));
  const zone = zoneOf(row);
  if (!m || zone === undefined) return undefined;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) - zone * 60_000;
}

/** a minute either way for the phone's and the server's clocks */
const SKEW_MS = 60_000;

/**
 * The day (yyyy-MM-dd, as the server filed it) of a check in saved since sinceMs - the case's own; undefined when none
 * was saved since then (an older check in of the run never counts) or a row has no clock to tell.
 */
export function savedCheckInDay(rows: Row[], sinceMs: number): string | undefined {
  const own = rows.filter((r) => Number(r.TransactionTypeID) === 1 && (instantOf(r) ?? -Infinity) >= sinceMs - SKEW_MS);
  const days = own.map((r) => String(r.CreateDate).slice(0, 10)).sort();
  return days.length ? days[days.length - 1] : undefined;
}
