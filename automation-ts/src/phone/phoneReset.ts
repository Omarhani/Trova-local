/** one Appium command on the phone session ("mobile: clearApp" ...) */
export type PhoneCommand = (command: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * The app as a new block's session starts it (base.PhoneOptions, noReset off): closed, its data cleared, every
 * permission granted again (autoGrantPermissions), opened - on the run's kept session instead of a new one.
 */
export async function freshApp(call: PhoneCommand, appId: string): Promise<void> {
  await call('mobile: terminateApp', { appId });
  await call('mobile: clearApp', { appId });
  await call('mobile: changePermissions', { permissions: 'all', appPackage: appId, action: 'grant' });
  await call('mobile: activateApp', { appId });
}

/** a kept-data block: the app closed and opened again with its data (Java BaseTests.goHome) */
export async function reopenApp(call: PhoneCommand, appId: string): Promise<void> {
  await call('mobile: terminateApp', { appId });
  await call('mobile: activateApp', { appId });
}

/**
 * The clean-up's sign-out with no screens (Omar 2026-11-11): the app closed and its data cleared - no user is kept on
 * the phone; true when the app is then not running (Appium app state 1)
 */
export async function signOutByClearing(call: PhoneCommand, appId: string): Promise<boolean> {
  await call('mobile: terminateApp', { appId });
  await call('mobile: clearApp', { appId });
  // runs 727/729: clearing the data took the app's permissions too - the next sign-in met Android's location question
  await call('mobile: changePermissions', { permissions: 'all', appPackage: appId, action: 'grant' });
  return Number(await call('mobile: queryAppState', { appId })) === 1;
}
