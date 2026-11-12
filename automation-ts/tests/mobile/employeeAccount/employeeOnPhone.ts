import { accountCode, employeePassword } from '../../../src/api/flows/employeeValues';
import { NewEmployee } from '../../../src/data/newEmployee';
import { param } from '../../../src/run/blockParams';
import { runEmployees } from '../../../src/run/runEmployee';
import { testData } from '../../../src/run/testData';
import { Phone } from '../../../src/phone/phoneSession';
import { HomeScreen } from '../../../src/phone/screens/HomeScreen';
import { SignInScreen } from '../../../src/phone/screens/SignInScreen';

/** the server box the app is set to: the block's "server", else the run's environment */
export function server(): string {
  return param('server', testData.env());
}

/** the employee's password now: the saved one, or the next one once this run changed it - never printed */
export function passwordOf(e: NewEmployee): string {
  return employeePassword(runEmployees.passwordChanged(e.userName));
}

/** the app's sign-in on its screens as the run's employee (account code, server, user name, password), then home */
export async function signInAs(phone: Phone, e: NewEmployee, password: string = passwordOf(e)): Promise<void> {
  await new SignInScreen(phone).signIn({ accountCode: accountCode(), userName: e.userName, password }, server());
  await new HomeScreen(phone).allowLocationIfAsked();
}
