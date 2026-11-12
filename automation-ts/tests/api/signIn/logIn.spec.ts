import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { trovaTest as test } from '../../../src/run/trovaTest';
import { signIn } from '../../../src/signin/signIns';
import { signInLine } from '../../../src/records/signInLine';
import { checkTrue } from '../../../src/report/checks';

/**
 * The run's ONE sign-in by quick calls (the app's own sign-in calls, or the tester's saved browser sign-in) - no browser,
 * no picture (run 687, owner). The first web case's own start proves the app opens signed in with it. Its line names
 * the user and the way: "Sign in as Admin (by API)".
 */
test('logInProgrammatically', async () => {
  const login = runLogin(param('signedInAs', ''));
  const result = await signIn(login, 'web');
  checkTrue(signInLine(login, 'api'), result.token.trim() !== '', 'the app gave no token');
});
