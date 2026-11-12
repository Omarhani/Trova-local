import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { needsPhone } from '../phone/appiumServer';
import { appiumAddress } from '../phone/phoneSession';
import { BrowserLook } from '../signin/browserSignIn';
import { browserSignIns } from '../signin/browserSignInFile';
import { asObject, asText, section } from './runDataFile';
import { lockedIn, lockGoneWithin, phoneStateIn } from './phoneReady';
import { PreRunDeps } from './preRunCheck';
import { SuitePlan } from './suitePlan';
import { testData } from './testData';

/** adb of the Android tools Trova gave the run (ANDROID_HOME / ANDROID_SDK_ROOT), else the one on the PATH; '' = none */
export function adbPath(env: NodeJS.ProcessEnv = process.env, exists: (f: string) => boolean = fs.existsSync): string {
  for (const sdk of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    if (!sdk?.trim()) continue;
    const adb = path.join(sdk.trim(), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (exists(adb)) return adb;
  }
  return 'adb';
}

function adb(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(adbPath(), args, { timeout: 5_000, windowsHide: true }, (e, out) => (e ? reject(e) : resolve(String(out))));
  });
}

/** connected and unlocked (an unlocked-by-swipe lock screen is woken and put away, as Appium does; a code lock is not) */
async function phoneReady(): Promise<string | null> {
  let devices: string;
  try {
    devices = await adb(['devices']);
  } catch {
    return null; // no adb here: the phone server says it at the first phone case
  }
  const udid = process.env.TROVA_UDID?.trim() ?? '';
  const state = phoneStateIn(devices, udid);
  if (state) return state;
  const on = udid ? ['-s', udid] : [];
  const locked = async (): Promise<boolean> => lockedIn(await adb([...on, 'shell', 'dumpsys', 'window']).catch(() => ''));
  if (!(await locked())) return null;
  await adb([...on, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']).catch(() => '');
  await adb([...on, 'shell', 'wm', 'dismiss-keyguard']).catch(() => '');
  return (await lockGoneWithin(locked, UNLOCK_WAIT_MS)) // review G14: a condition wait, no fixed sleep
    ? null : 'The phone is locked - unlock it and run again (Trova never types a phone\'s lock code)';
}

const UNLOCK_WAIT_MS = 2_000;

async function answers(url: string, ms: number): Promise<string | null> {
  try {
    await fetch(url, { method: 'GET', signal: AbortSignal.timeout(ms) });
    return null;
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code ?? (e instanceof Error ? e.name : '');
    return cause ? String(cause) : 'no answer';
  }
}

async function appiumUp(): Promise<string | null> {
  const a = appiumAddress();
  const why = await answers(`http://${a.hostname}:${a.port}${a.path.replace(/\/$/, '')}/status`, 3_000);
  return why ? `The phone server (Appium) does not answer on ${a.hostname}:${a.port} (${why})` : null;
}

async function appUp(): Promise<string | null> {
  const url = testData.apiUrl() || testData.webUrl();
  if (!url) return null; // no address: the first case says which one to add
  const why = await answers(url, 6_000);
  return why ? `The app's server (${new URL(url).host}) could not be reached from this computer (${why}) - check the network or the environment's address` : null;
}

/** the logins the suite signs in as: every block's signedInAs, else the run's login */
function webLogins(plan: SuitePlan): string[] {
  const named = plan.blocks.map((b) => b.params.signedInAs ?? '').filter((l) => l && !l.startsWith('${'));
  const forced = process.env.TROVA_LOGIN?.trim();
  let run = '';
  try {
    run = asText(asObject(section('run')).login);
  } catch {
    run = ''; // no run file: nothing to look at
  }
  return [...named, ...(forced ? [forced] : []), ...(run ? [run] : [])];
}

/** the saved sign-in, or none when the run's data cannot say which environment this is */
function lookSafely(login: string): BrowserLook {
  try {
    return browserSignIns.look(login);
  } catch {
    return { kind: 'none' };
  }
}

/** the real computer behind the pre-run check */
export function preRunDeps(plan: SuitePlan): PreRunDeps {
  return {
    webLogins: webLogins(plan), needsPhone: needsPhone(plan),
    look: (login) => lookSafely(login), phone: phoneReady, appium: appiumUp, app: appUp, now: () => Date.now(),
  };
}
