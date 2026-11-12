import { PHONE_TIME_ZONE_OFFSET } from '../api/phoneEnvelope';

const MINUTE = 60_000;
const QUARTER = 15;
/** the world's clocks run from UTC-12 to UTC+14: a stamp further off is a wrong stamp, not a clock */
const WEST_MOST = -12 * 60;
const EAST_MOST = 14 * 60;

/** yyyy-MM-dd of the moment on a clock offsetMin minutes ahead of UTC */
export function dayAt(ms: number, offsetMin: number): string {
  return new Date(ms + offsetMin * MINUTE).toISOString().slice(0, 10);
}

/** the moment's wall time on that clock as a Date read with its own getters (getFullYear, getDate, getHours ...) */
export function wallAt(ms: number, offsetMin: number): Date {
  const u = new Date(ms + offsetMin * MINUTE);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
}

/**
 * The clock a server stamp shows: "2026-11-13T00:05:26.88" is its own wall time (no zone) of a record made at atMs -
 * the minutes it is ahead of UTC, to the quarter hour; undefined when it is not a time or further off than any clock.
 */
export function offsetOfStamp(stamp: unknown, atMs: number): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(stamp ?? '').trim());
  if (!m) return undefined;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const offset = Math.round((wall - atMs) / (QUARTER * MINUTE)) * QUARTER;
  return offset >= WEST_MOST && offset <= EAST_MOST ? offset : undefined;
}

/** "UTC+3" / "UTC-4:30" */
function clockName(offsetMin: number): string {
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`;
}

/**
 * The app's own clock (runs 1025 / 1026, Omar 2026-11-12): every "today" a case expects is the day on this clock,
 * never the computer's. It starts on its fallback and takes the clock the server's own answers show (learn).
 */
export class AppClock {
  private learned: number | undefined;

  constructor(private readonly name: string, private readonly fallback: () => number,
              private readonly now: () => number = () => Date.now()) {}

  offsetMin(): number {
    return this.learned ?? this.fallback();
  }

  /** the server showed its clock (an offset); nothing = the clock stays as it is */
  learn(offsetMin: number | undefined): void {
    if (offsetMin === undefined || offsetMin === this.learned) return;
    this.learned = offsetMin;
    console.log(`The app's ${this.name} clock is ${clockName(offsetMin)} (from the app's own answer) - its "today" is ${this.today()}`);
  }

  today(): string {
    return dayAt(this.now(), this.offsetMin());
  }

  wallNow(): Date {
    return this.wallAt(this.now());
  }

  wallAt(ms: number): Date {
    return wallAt(ms, this.offsetMin());
  }
}

/** the account's clock: until a server stamp shows it, the one the app's own calls state (TimeZoneOffset -180 = UTC+3) */
export const accountClock = new AppClock('account', () => -PHONE_TIME_ZONE_OFFSET);

/** the attendance clock: the gate's, as the server files a movement (its LocalTimeZone); until then the account's */
export const attendanceClock = new AppClock('attendance', () => accountClock.offsetMin());

/**
 * The web portal's own clock: its forms fill "today" / "tomorrow" by its page's, the browser's - which runs on this
 * computer. Only for a value the web form shows by itself (the shift form's start date); never for what the app stores.
 */
export function webPageNow(): Date {
  return new Date();
}
