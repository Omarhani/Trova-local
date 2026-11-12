import { trovaTest as test } from '../../../src/run/trovaTest';
import { AppApi } from '../../../src/api/appApi';
import { registrationRequestKind } from '../../../src/api/records/registrationRequestKind';
import { PendingUsersApi } from '../../../src/api/services/pendingUsersApi';
import { param } from '../../../src/run/blockParams';
import { runLogin } from '../../../src/run/credentials';
import { cleanUpRun } from '../../../src/records/cleanUpByIds';
import { once } from '../../../src/records/recordKind';
import { signInLine } from '../../../src/records/signInLine';
import { checkTrue } from '../../../src/report/checks';

/** Set-up (sign in once by API) and clean-up (delete by id what the run made, each read back gone) of the Employee suites. */
test('logInProgrammatically', async () => {
  const login = runLogin(param('signedInAs', 'Admin'));
  const admin = await AppApi.signedInAs(login, 'web');
  checkTrue(signInLine(login, 'api'), admin !== undefined);
});

test('cleanUpProgrammatically', async () => {
  const login = runLogin(param('signedInAs', 'Admin'));
  await cleanUpRun([registrationRequestKind(once(async () => new PendingUsersApi(await AppApi.signedInAs(login, 'web'))))]);
});
