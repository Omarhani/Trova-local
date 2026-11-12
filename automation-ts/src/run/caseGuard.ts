import type { Stops } from './runStops';

/** Round 2: what every TS case goes through before and after its own steps - plain rules, the base test wires them. */

/** a second try runs only when the reporter allowed it (a set-up problem); else it steps aside and the first try stands */
export function retryGate(retry: number, allowed: boolean): string | undefined {
  if (retry > 1) return 'The second try stands - a set-up problem is tried exactly once more'; // whatever the run's try count
  return retry > 0 && !allowed ? 'The first try stands - only a set-up problem is tried again' : undefined;
}

/** the pre-run check's stop that touches this case: the app's server stops every case, the phone only phone cases */
export function stopFor(side: 'api' | 'web' | 'phone', stops: Stops): string | undefined {
  return stops.app ?? (side === 'phone' ? stops.phone : undefined);
}

export const NO_CHECK = 'FAILED: no check of the expected result - a case passes only when it checked what it expects';

export const SET_UP_SHOWED_NOTHING = 'The set-up showed nothing it made - no record handed to the cases and no check that it is there';

/** what a block is: a set-up (sign-in, records made), a clean-up, or a case with an expected result */
export type BlockRole = 'setup' | 'cleanup' | 'case';

const CLEAN_UP = /^clean[ _-]?up/i;
const SET_UP = /^(set[ _-]?up|log[ _-]?in[ _-]?programmatically)|programmatically$/i;

/** Round 2 review: by the test's name or its block's ("Set-up - ...", "Clean up - ...", "Log in programmatically") */
export function blockRole(title: string, block: string): BlockRole {
  const names = [title.trim(), block.trim()];
  if (names.some((n) => CLEAN_UP.test(n))) return 'cleanup';
  return names.some((n) => SET_UP.test(n)) ? 'setup' : 'case';
}

/** a case that passed without one check of its expected result: the failure to give it, else undefined */
export function noCheckFailure(status: string, checksBefore: number, checksAfter: number): string | undefined {
  return status === 'passed' && checksAfter === checksBefore ? NO_CHECK : undefined;
}

/**
 * Round 2 review: what a passed block's own steps proved. A case needs a check of its expected result in its steps (a
 * check in its clean-up does not count); a set-up needs a record handed to the cases or a check that it is there, else
 * it is BLOCKED; a clean-up is not judged here (its own checks say what is left).
 */
export function afterSteps(role: BlockRole, status: string, checks: number, records: number): { failed?: string; blocked?: string } {
  if (status !== 'passed' || role === 'cleanup') return {};
  if (role === 'case') return checks === 0 ? { failed: NO_CHECK } : {};
  return checks === 0 && records === 0 ? { blocked: SET_UP_SHOWED_NOTHING } : {};
}
