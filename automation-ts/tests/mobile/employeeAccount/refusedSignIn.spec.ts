import { accountCode } from '../../../src/api/flows/employeeValues';
import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { expectedWrongLoginMessage, WRONG_ACCOUNT_CODE_MESSAGE, wrongPasswordOf } from '../../../src/data/refusedSignIn';
import { param } from '../../../src/run/blockParams';
import { checkContains, checkEquals } from '../../../src/report/checks';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { AccountCodeScreen } from '../../../src/phone/screens/AccountCodeScreen';
import { SignInScreen } from '../../../src/phone/screens/SignInScreen';
import { passwordOf, server } from './employeeOnPhone';

/**
 * The app refuses a wrong sign-in - the TS twins of Java MobLoginTests (verifyThatUserCannotLoginWithInvalidAccountCode,
 * verifyThatValidationMessageAppearIfUserInsertInvalidCredentials). The app starts clean on its account code screen. The
 * wrong password is tried only on the employee this run made, so no real account is ever refused.
 */
test('testVerifyThatTheUserCannotLogInWithAWrongAccountCode', async ({ phone }) => {
  const screen = new AccountCodeScreen(phone);
  await screen.submitAccountCode(param('wrong_account_code', 'Autooo'), server());

  checkContains('Wrong account code message', await screen.toastOnce(), WRONG_ACCOUNT_CODE_MESSAGE);
});

test('testVerifyThatTheAppShowsAMessageForAWrongPassword', async ({ phone }) => {
  const e = await approvedEmployeeOfRun();
  const screen = new AccountCodeScreen(phone);
  await screen.openSignInForm(accountCode(), server());
  await new SignInScreen(phone).submitLogin(e.userName, wrongPasswordOf(passwordOf(e)));

  const shown = await screen.toastOnce(); // in the app's language: the Arabic words when it is Arabic (as Java)
  checkEquals('Wrong password message', shown, expectedWrongLoginMessage(shown));
});
