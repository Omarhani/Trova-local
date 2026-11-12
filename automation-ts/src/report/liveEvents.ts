/**
 * The live feed Trova's runner reads from a run's console - one "@@live {json}" line per event (run, test, end, step,
 * check), exactly as the Java helpers (utils.LiveFeed) print them, so the Runs tab shows a TS run the same way.
 */
export type LiveEvent = Record<string, unknown> & { t: string };

export const LIVE = '@@live ';

/** one console line, ASCII only (Arabic as \uXXXX) so any console encoding keeps it */
export function liveLine(event: Record<string, unknown>): string {
  const withTime = { at: Date.now(), ...event };
  return LIVE + JSON.stringify(withTime).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** prints one event (from the test process or the reporter) */
export function emit(type: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${liveLine({ t: type, ...fields })}\n`);
}

/** a test's kind in the words the run screen knows (Java: Web, Mobile, API) - "Mobile" shows the phone as a phone */
export function testType(groups: string[]): 'Mobile' | 'Web' | 'API' {
  return groups.includes('Mob') ? 'Mobile' : groups.includes('Web') ? 'Web' : 'API';
}

export function statusOf(playwrightStatus: string): 'pass' | 'fail' | 'skip' {
  if (playwrightStatus === 'passed') return 'pass';
  if (playwrightStatus === 'skipped') return 'skip';
  return 'fail';
}

/** the "end" event of a test: its status and the first error (or the skip reason) in plain text */
export function endEvent(playwrightStatus: string, errors: string[], skipReason?: string): LiveEvent {
  const status = statusOf(playwrightStatus);
  const raw = status === 'skip' ? skipReason ?? '' : errors[0] ?? '';
  // eslint-disable-next-line no-control-regex
  const msg = raw.replace(/\u001b\[[0-9;]*m/g, '').trim();
  return { t: 'end', status, msg: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg };
}
