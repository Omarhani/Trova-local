import { param } from '../run/blockParams';
import { runLogin } from '../run/credentials';
import { runMode } from '../run/runMode';
import { signInLine } from './signInLine';

/**
 * The web page's sign-in line for the running block: the login the page signed in as (signedInAs, as webTest) and the
 * way the run's mode used - "Sign in as Admin (by screens)" in full screen mode, "(by API)" otherwise.
 */
export function runSignInLine(): string {
  return signInLine(runLogin(param('signedInAs', '')), runMode() === 'ui' ? 'screens' : 'api');
}
