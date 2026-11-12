import { SetUpProblem } from '../../report/failureKind';
import { causeWords, firstLine, HelpAnswer } from './helpAnswer';

/** the same kind of failure with the plain reason first (the step's error kept as its cause) */
export type Same = (why: string, cause: Error) => Error;

const plainSame: Same = (why, cause) => new Error(why, { cause });

/**
 * Self-healing batch 1 (Omar 2026-11-11), the same for web and phone: AI help did not get past the step - the cause
 * decides. The app wrong = a real bug (FAILED, Expected / Actual); the network, the browser or phone, or our own step
 * = not the app's answer (BLOCKED); no cause = the plain reason (or the step's own failure).
 */
export function notPast(a: HelpAnswer, failed: Error, same: Same = plainSame): Error {
  if (a.cause === 'APP') return new Error(`Expected: this step goes on / Actual: ${a.proof || a.did || firstLine(failed)}`, { cause: failed });
  if (a.cause === 'ENVIRONMENT' || a.cause === 'OUR_CODE') {
    const head = a.cause === 'OUR_CODE' ? 'our test step needs a look' : `${causeWords(a.cause)} let it down`;
    return new SetUpProblem(`Not checked - ${head}: ${a.proof || a.did || firstLine(failed)}`);
  }
  if (!a.why?.trim()) return failed;
  return same(`${a.why} - ${firstLine(failed)}`, failed);
}

/** AI help got past it but the step is still stuck: our own step (a renamed element) = BLOCKED, never the app's fault */
export function stillStuck(a: HelpAnswer, again: Error, same: Same = plainSame): Error {
  if (a.cause === 'OUR_CODE') return new SetUpProblem(`Not checked - our test step needs a look: ${a.proof || a.did || firstLine(again)}`);
  return same(`Still stuck after AI help (${a.did}) - ${firstLine(again)}`, again);
}
