import { accountCode, employeePassword } from '../../../src/api/flows/employeeValues';
import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { refusalAnswered, wrongPasswordOf } from '../../../src/data/refusedSignIn';
import { param } from '../../../src/run/blockParams';
import { checkTrue } from '../../../src/report/checks';
import { LoginPage } from '../../../src/web/pages/LoginPage';
import { signedOutWebTest as test } from '../../../src/web/signedOutTest';

/**
 * The portal refuses a wrong sign-in - the TS twins of Java LoginTests (verifyThatValidationAppearIfUserInsertInvalidCredentials,
 * verifyThatValidationIsAppearIfUserInsertInvalidAccountCode), each on a signed-out page. The wrong password is tried
 * only on the employee this run made by API, so no real account is ever refused.
 */
test('testVerifyThatTheWebShowsAMessageForAWrongPassword', async ({ page }) => {
  const e = await approvedEmployeeOfRun();
  const login = new LoginPage(page);
  await login.navigateTo();
  await login.insertAccountCode(accountCode());
  await login.clickNext();
  await login.insertUsername(e.userName);
  await login.insertPassword(wrongPasswordOf(employeePassword(false)));
  const answered = refusalAnswered(await login.clickLoginAnswered(15), 15); // run 860: no answer = not checked

  const shown = await login.toasterMessage();
  checkTrue('Error message shown for the wrong password', shown !== '', shown ? `the app said "${shown}"` : `${answered}, but no message showed within 10 s`);
});

test('testVerifyThatTheWebShowsAMessageForAWrongAccountCode', async ({ page }) => {
  const login = new LoginPage(page);
  await login.navigateTo();
  await login.insertAccountCode(param('wrong_account_code', 'Autooo'));
  await login.clickNext();

  const shown = await login.toasterMessage();
  checkTrue('Error message shown for the wrong account code', shown !== '', shown ? `the app said "${shown}"` : 'no message showed within 10 s');
});
