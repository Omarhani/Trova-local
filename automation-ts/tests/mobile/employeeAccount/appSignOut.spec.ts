import { checkTrue } from '../../../src/report/checks';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { onPhone } from '../../../src/phone/phoneGone';
import { signOutByClearing } from '../../../src/phone/phoneReset';
import { testData } from '../../../src/run/testData';

/**
 * Clean-up on the phone before the employee is deleted (Test 8094 run 658: hybrid 64 deleted its employee while the app
 * was still signed in as it - the next suite met "User has been deleted." and could not sign in). Omar 2026-11-11 (runs
 * 713 / 717): no screens - the app is closed and its data cleared, so no user stays signed in on the phone (1-2 s, where
 * My Profile > Logout took 20 s).
 */
test('signOutOfTheAppProgrammatically', async ({ phone }) => {
  const call = (command: string, args: Record<string, unknown>) => onPhone(() => phone.execute(command, args));
  checkTrue('Sign-out · the app is closed with its data cleared (no user signed in on the phone)',
    await signOutByClearing(call, testData.mobile().appPackage));
});
