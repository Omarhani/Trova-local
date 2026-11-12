import { Page } from '@playwright/test';
import { credentials } from '../../run/credentials';
import { proveSignedIn } from './appProof';
import { keepRecipe, keepState, screenRecipe } from './keptSignIn';
import { readState } from './browserPut';
import { robotCheckShown, robotWords } from './robotCheck';
import { beforeRobotTimeout, robotTimeoutWords, watchRobotTimeout } from './robotTimeout';
import { pageSays } from './signInPage';
import { SignInProblem } from '../../report/failureKind';
import { screenSignIn } from './screenSignIn';
import { appName } from './signInRefusal';

/**
 * Full screen mode: the run's ONE sign-in on the app's sign-in page with the login's saved steps, then proved. A robot
 * check that blocks it stops at once with that reason - Trova never gets around it. null = proved, else why not.
 */
export async function screenSignInto(page: Page, web: string, login: string): Promise<string | null> {
  const recipe = screenRecipe(login);
  if (!recipe) {
    throw new Error(`Trova has no saved sign-in steps for "${login}" - run one AI session that signs in as ${login}, so full screen mode can sign in on the sign-in page`);
  }
  try {
    const abort = new AbortController();
    const watch = watchRobotTimeout(page, () => pageSays(page));
    const { healed } = await beforeRobotTimeout(screenSignIn(page, web, login, recipe, credentials.of(login), abort.signal), watch,
      robotTimeoutWords(appName(web), login), abort); // Test 8094 run 622: stops in seconds, not at the 5-min limit
    if (healed) keepRecipe(login, healed);
  } catch (e) {
    if (e instanceof SignInProblem) throw e;
    await stopOnRobot(page, web, login);
    throw e;
  }
  const why = await proveSignedIn(page, web);
  if (why) {
    await stopOnRobot(page, web, login);
    return why;
  }
  keepState(login, await readState(page), web);
  return null;
}

async function stopOnRobot(page: Page, web: string, login: string): Promise<void> {
  if (await robotCheckShown(page)) throw new SignInProblem(robotWords(appName(web), login));
}
