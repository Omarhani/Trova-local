import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { trovaTest as test } from '../../../src/run/trovaTest';
import { signIn } from '../../../src/signin/signIns';
import { checkTrue } from '../../../src/report/checks';

/**
 * The run's ONE sign-in by quick calls (the app's own sign-in calls, or the tester's saved browser sign-in) - no browser,
 * no picture (run 687, owner). The first web case's own start proves the app opens signed in with it.
 */
test('logInProgrammatically', async () => {
  const login = runLogin(param('signedInAs', ''));
  const result = await signIn(login, 'web');
  checkTrue(`Sign-in · ${login} signed in by quick calls (no screen)`, result.token.trim() !== '');
});
