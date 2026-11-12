import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { appiumMain, AppiumPlace, ensureAppium } from './appiumServer';

/** an answer on /status (any HTTP answer) = something listens there */
async function listening(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(2_000) });
    return true;
  } catch {
    return false;
  }
}

/** Appium with its own log (target/appium.log, as the Java phone suites keep it); stopping kills it */
function start(place: AppiumPlace, args: string[]): () => void {
  const target = path.resolve(__dirname, '..', '..', 'target');
  fs.mkdirSync(target, { recursive: true });
  const log = fs.openSync(path.join(target, 'appium.log'), 'w');
  const child = spawn(place.node, [place.main, ...args], { stdio: ['ignore', log, log], windowsHide: true });
  console.log('Started the phone server (Appium) for this run');
  return () => {
    if (child.exitCode === null) child.kill();
    console.log('Stopped the phone server (Appium) of this run');
  };
}

/** item 10 (Test 8094 run 662): the server gets this long to answer on /status (looked at every 250 ms) */
export const APPIUM_START_MS = 120_000;

/**
 * Playwright's global set-up of a suite with phone tests: the phone server is there before the first block and the one
 * this run started is stopped after the last (the Java phone suites do the same in BaseTests).
 */
export default async function appiumSetup(): Promise<(() => void) | undefined> {
  const url = new URL(process.env.TROVA_APPIUM_URL ?? 'http://127.0.0.1:4723');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return undefined; // another computer's server: not ours to start
  return ensureAppium(Number(url.port || 4723), {
    listening, start, waitMs: APPIUM_START_MS,
    find: () => appiumMain(process.env, process.execPath, (f) => fs.existsSync(f)),
  });
}
