import { param } from '../run/blockParams';
import { credentials } from '../run/credentials';
import { testData } from '../run/testData';
import { Phone } from './phoneSession';
import { HomeAccount } from './screens/HomeAccount';
import { HomeScreen } from './screens/HomeScreen';
import { SignInScreen } from './screens/SignInScreen';

/**
 * the app opens signed in with its kept sign-in; else ONE sign-in on its screens as the login (the code types the saved
 * values, never the test). A kept app comes back on the screen it was left on (real phone 2026-11-11: on Leave, no
 * home) - so it is opened again first.
 */
export async function openSignedIn(phone: Phone, login: string): Promise<void> {
  await new HomeAccount(phone).reopenApp(testData.mobile().appPackage);
  await new SignInScreen(phone).signIn({
    accountCode: credentials.get(login, 'account code|Account code|Account|code'),
    userName: credentials.get(login, 'Username|User name|User|Email'),
    password: credentials.get(login, 'Password'),
  }, param('server', testData.env()));
  await new HomeScreen(phone).allowLocationIfAsked();
}
