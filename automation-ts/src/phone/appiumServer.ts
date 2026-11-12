import * as path from 'node:path';
import type { SuitePlan } from '../run/suitePlan';

/** where Appium is: the node that runs it and its main file */
export interface AppiumPlace {
  node: string;
  main: string;
}

/** what ensureAppium needs from the computer (tests give fakes) */
export interface AppiumDeps {
  listening: (port: number) => Promise<boolean>;
  find: () => AppiumPlace | undefined;
  /** starts the server; gives back how to stop it */
  start: (place: AppiumPlace, args: string[]) => () => void;
  waitMs: number;
}

export const NOT_INSTALLED = 'Appium is not on this computer - install the phone tools in Trova (Devices) and run again';

/** a suite with a phone spec or a block in the phone group (Mob) needs the phone server */
export function needsPhone(plan: SuitePlan): boolean {
  return plan.blocks.some((b) => b.groups.some((g) => /^mob/i.test(g))
    || b.tests.some((t) => t.spec.replace(/\\/g, '/').replace(/^\.?\//, '').startsWith('tests/mobile/')));
}

/**
 * Appium as the Java phone suites find it: the runner kit's (APPIUM_BINARY_PATH + NODE_BINARY_PATH, given to every run
 * by RunnerKit), else the Appium installed with this node (npm -g: next to node, ../lib, or Windows' %APPDATA%/npm).
 */
export function appiumMain(env: NodeJS.ProcessEnv, nodePath: string, exists: (file: string) => boolean): AppiumPlace | undefined {
  const kit = env.APPIUM_BINARY_PATH?.trim();
  if (kit && exists(kit)) return { node: env.NODE_BINARY_PATH?.trim() || nodePath, main: kit };
  const dir = path.dirname(nodePath);
  const npmGlobal = env.APPDATA ? [path.join(env.APPDATA, 'npm', 'node_modules', 'appium', 'build', 'lib', 'main.js')] : [];
  for (const main of [path.join(dir, 'node_modules', 'appium', 'build', 'lib', 'main.js'),
                      path.join(dir, '..', 'lib', 'node_modules', 'appium', 'build', 'lib', 'main.js'), ...npmGlobal]) {
    if (exists(main)) return { node: nodePath, main };
  }
  return undefined;
}

/** the driver the run's phone sessions use (phoneSession: automationName UiAutomator2) */
export const PHONE_DRIVER = 'uiautomator2';

/**
 * the same server the Java phone suites start (base.AppiumServer), with only the driver the run uses - item 10, Test
 * 8094 run 662: Appium 3 loaded every installed driver (flutter-integration alone took 35 s on a busy PC)
 */
export function appiumArgs(port: number): string[] {
  return ['--address', '127.0.0.1', '--port', String(port), '--allow-insecure', `${PHONE_DRIVER}:adb_shell`,
    '--use-drivers', PHONE_DRIVER, '--log-timestamp', '--log-no-colors'];
}

/**
 * Test 8094 run 591 ("Unable to connect to 127.0.0.1:4723"): the phone server this run needs. One already listening is
 * used as it is (an AI phone session or another run may own it) and never stopped; else this run starts its own and
 * gives back how to stop it. Plain words when Appium is missing or does not start.
 */
export async function ensureAppium(port: number, deps: AppiumDeps): Promise<(() => void) | undefined> {
  if (await deps.listening(port)) return undefined;
  const place = deps.find();
  if (!place) throw new Error(NOT_INSTALLED);
  const stop = deps.start(place, appiumArgs(port));
  const until = Date.now() + deps.waitMs;
  while (Date.now() < until) {
    if (await deps.listening(port)) return stop;
    await new Promise((r) => setTimeout(r, 250));
  }
  stop();
  throw new Error(`Appium did not start within ${Math.round(deps.waitMs / 1000)} s - see target/appium.log`);
}
