import { attach, remote } from 'webdriverio';
import { testData } from '../run/testData';
import { KeptPhone } from './keptPhone';
import { streamCapabilities } from './phoneStreamCaps';

export type Phone = WebdriverIO.Browser;

/** the phone of the run: the one picked in the Run dialog (TROVA_UDID), else the only one adb sees (Appium picks it) */
function udid(): string | undefined {
  return process.env.TROVA_UDID?.trim() || undefined;
}

/**
 * A phone session on the environment's app, set up as the Java mobile tests set it up (base.PhoneOptions): app data
 * cleared at the start, permissions granted, Appium's keyboard for any text, no idle waits (the home screen animates);
 * its screen streamed to filmPort for the run's film (phoneFilmPlayer). keepAppData: the app keeps its data - and the
 * run's one sign-in in it - for a case that reuses that sign-in instead of signing in again.
 */
export async function openPhone(filmPort: number, keepAppData = false): Promise<Phone> {
  const app = testData.mobile();
  if (!app.appPackage) {
    throw new Error(`No app for the ${testData.env()} environment: add its package and start screen in Trova > Test Data > Environments > Mobile app`);
  }
  return remote({
    ...appiumAddress(),
    logLevel: 'warn',
    connectionRetryTimeout: 120_000,
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android',
      ...(udid() ? { 'appium:udid': udid() } : {}),
      'appium:appPackage': app.appPackage,
      'appium:appActivity': app.appActivity,
      'appium:autoGrantPermissions': true,
      'appium:ignoreHiddenApiPolicyError': true,
      'appium:unicodeKeyboard': true,
      'appium:resetKeyboard': true,
      'appium:disableWindowAnimation': true,
      'appium:waitForIdleTimeout': 0,
      'appium:enforceAppInstall': false,
      'appium:noReset': keepAppData,
      'appium:newCommandTimeout': 300,
      ...streamCapabilities(filmPort, udid()),
    } as WebdriverIO.Capabilities,
  });
}

/** the phone server (Appium) of the run: TROVA_APPIUM_URL, else this computer's port 4723 */
export function appiumAddress(env: NodeJS.ProcessEnv = process.env): { hostname: string; port: number; path: string } {
  const appium = new URL(env.TROVA_APPIUM_URL ?? 'http://127.0.0.1:4723');
  return { hostname: appium.hostname, port: Number(appium.port || 4723), path: appium.pathname === '/' ? '/' : appium.pathname };
}

/** the run's kept phone session, joined from this block's process (no call to the phone yet) */
export async function attachPhone(kept: KeptPhone): Promise<Phone> {
  return attach({ ...appiumAddress(), logLevel: 'warn', sessionId: kept.sessionId, capabilities: kept.capabilities as WebdriverIO.Capabilities });
}
