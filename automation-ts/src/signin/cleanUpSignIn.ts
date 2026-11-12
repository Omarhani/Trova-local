import { blockNow } from '../run/blockNow';
import { BlockRole } from '../run/caseGuard';
import { SignInResult } from '../trova/recipeSignIn';
import { SkipLogin } from './skipLogin';

/** what the clean-up stands on: the block running now, the sign-in the run already holds (no sign-in call), the run line */
export interface CleanUpSignInDeps {
  role: () => BlockRole | undefined;
  held: () => SignInResult | undefined;
  say: (line: string) => void;
}

/**
 * Test 8094 run 973: a case's sign-in of the login was stopped earlier in the run. A later case is skipped with that
 * reason; the clean-up still deletes what the run made - by API, with the sign-in the run already holds (Java runs its
 * clean-up after a failed case too). It holds none = skipped with the reason: never a new sign-in call.
 */
export function cleanUpSignIn(login: string, stopped: string, d: CleanUpSignInDeps): SignInResult {
  const held = d.role() === 'cleanup' ? heldOrNone(d) : undefined;
  if (!held) throw new SkipLogin(stopped);
  d.say(`Clean-up by API with this run's sign-in of ${login} - an earlier case could not use it (${stopped})`);
  return held;
}

function heldOrNone(d: CleanUpSignInDeps): SignInResult | undefined {
  try {
    return d.held();
  } catch {
    return undefined; // a held sign-in that ended: the stop's own reason is the clearer one
  }
}

/** the base test's block role */
export const cleanUpRole = (): BlockRole | undefined => blockNow.role();
