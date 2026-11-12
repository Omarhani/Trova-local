import { Movement } from '../../../src/api/services/transactionsApi';

/**
 * The web cases' record: the employee's app check in and check out of today, made by the app cases before them (an app
 * check in has no call a run may make). Missing = the reason the case is not tested (run 1001: the check out case failed,
 * and the web cases must not fail on a set-up that an earlier failure took away).
 */
export function appMovementsMissing(app: Movement[]): string | undefined {
  const has = (kind: Movement['kind']): boolean => app.some((m) => m.kind === kind);
  if (has('check in') && has('check out')) return undefined;
  return "Not tested - needs the employee's check in and check out on the app today, made by the app check in and check out cases before it (one of them did not pass)";
}
