import { compared, happened } from './checkWords';
import { emit } from './liveEvents';
import { secretValues } from './secretValues';
import { nextStep } from './stepNumbers';

const hide = (t: string): string => secretValues.hide(t);

/**
 * The test's checks, each one shown in Trova's run as a check line ("Add employee · toast") - the TS twin of
 * myAssertEquals / myAssertContains / myAssertTrue. A check passes only on the value really read. Its line says what,
 * expected, seen, then ✓ or ✗ (checkWords); a secret of the run shows ***.
 */
export function checkEquals<T>(what: string, actual: T, expected: T): void {
  const ok = Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
  settle(what, ok, compared(what, ok, show(expected), show(actual), hide));
}

export function checkContains(what: string, actual: string, part: string): void {
  const ok = actual.includes(part);
  settle(what, ok, compared(what, ok, `to contain "${part}"`, `"${actual}"`, hide));
}

/** why: the app's own words when it said no (Test 8094 run 575) - shown with the failure */
export function checkTrue(what: string, actual: boolean, why = ''): void {
  settle(what, actual, happened(what, actual, why, hide));
}

/** what must be false (myAssertFalse) */
export function checkFalse(what: string, actual: boolean): void {
  settle(what, !actual, happened(what, !actual, actual ? 'it was true' : '', hide));
}

/**
 * a line in the step's own words (a set-up's "Made employee id 512", a clean-up's "Deleted work plan id 41", or its
 * "Expected: ... / Actual: ..."), shown as a check; stop = a failed one ends the test with that line
 */
export function checkLine(line: string, ok: boolean, stop = true): void {
  const shown = happened(line, ok, '', hide);
  if (stop) settle(line, ok, shown);
  else report(line, ok, shown);
}

const listeners = new Set<() => void>();

/** someone who acts after every check (the phone takes its picture); gives back how to stop */
export function afterEachCheck(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** shows the check line; a failed check stops the test with that same plain line (never "Expected: true Received: false") */
function settle(what: string, ok: boolean, line: string): void {
  report(what, ok, line);
  if (!ok) throw new Error(line);
}

let made = 0;

/** how many checks this process made so far - a case that made none passes nothing (Round 2) */
export function checksMade(): number {
  return made;
}

function report(what: string, ok: boolean, line: string): void {
  made++;
  emit('check', { n: nextStep(), ok, d: line.slice(0, 300), c: hide(what) });
  for (const l of listeners) l();
}

function show(v: unknown): string {
  return typeof v === 'string' ? `"${v}"` : String(v);
}
