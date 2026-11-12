import { expect, test } from '@playwright/test';
import { appiumArgs, appiumMain, needsPhone } from '../../src/phone/appiumServer';
import { APPIUM_START_MS } from '../../src/phone/appiumSetup';
import { needsWeb, SuitePlan } from '../../src/run/suitePlan';

const plan = (spec: string, groups: string[] = []): SuitePlan =>
  ({ name: 's', params: {}, blocks: [{ name: 'b', params: {}, groups, tests: [{ spec, method: 'x' }] }] });

test('a suite with a phone spec or a Mob block needs the phone server; a web suite does not', () => {
  expect(needsPhone(plan('tests/mobile/attendance/attendance.spec.ts'))).toBe(true);
  expect(needsPhone(plan('tests/web/x.spec.ts', ['Mob']))).toBe(true);
  expect(needsPhone(plan('tests/web/emloyess2/emloyess2.spec.ts', ['Web']))).toBe(false);
});

test("Appium is the runner kit's one first (APPIUM_BINARY_PATH with its node)", () => {
  const env = { APPIUM_BINARY_PATH: 'K/npm/node_modules/appium/build/lib/main.js', NODE_BINARY_PATH: 'K/node/node.exe' };
  expect(appiumMain(env, 'C:/nodejs/node.exe', () => true)).toEqual({ node: 'K/node/node.exe', main: env.APPIUM_BINARY_PATH });
});

test('else the Appium installed next to this node (npm -g)', () => {
  const main = (p: string) => p.replace(/\\/g, '/');
  const found = appiumMain({}, 'C:/nodejs/node.exe', (p) => main(p) === 'C:/nodejs/node_modules/appium/build/lib/main.js');
  expect(found && main(found.main)).toBe('C:/nodejs/node_modules/appium/build/lib/main.js');
  expect(found?.node).toBe('C:/nodejs/node.exe');
});

test('no Appium anywhere = undefined (the run then says so in plain words)', () => {
  expect(appiumMain({}, '/usr/bin/node', () => false)).toBeUndefined();
});

test('the server starts like the Java phone suites: 127.0.0.1, the port, adb shell allowed, timed log lines', () => {
  expect(appiumArgs(4723)).toEqual(['--address', '127.0.0.1', '--port', '4723', '--allow-insecure', 'uiautomator2:adb_shell',
    '--use-drivers', 'uiautomator2', '--log-timestamp', '--log-no-colors']);
});

test('item 10 (Test 8094 run 662): only the driver the run needs is loaded, and the server gets 120 s to answer', () => {
  expect(appiumArgs(4723).join(' ')).toContain('--use-drivers uiautomator2'); // not flutter + flutter-integration (35 s alone)
  expect(APPIUM_START_MS).toBe(120_000);
});

test('a server already listening is used as it is and never stopped', async () => {
  const { ensureAppium } = await import('../../src/phone/appiumServer');
  let started = 0;
  const stop = await ensureAppium(4723, { listening: async () => true, find: () => ({ node: 'n', main: 'm' }), start: () => { started++; return () => undefined; }, waitMs: 50 });
  expect(started).toBe(0);
  expect(stop).toBeUndefined();
});

test('none listening: this run starts one, waits for it, and gives back how to stop it', async () => {
  const { ensureAppium } = await import('../../src/phone/appiumServer');
  let up = false;
  let stopped = false;
  const stop = await ensureAppium(4723, {
    listening: async () => up, find: () => ({ node: 'n', main: 'm' }),
    start: () => { setTimeout(() => { up = true; }, 30); return () => { stopped = true; }; }, waitMs: 2000,
  });
  expect(typeof stop).toBe('function');
  stop?.();
  expect(stopped).toBe(true);
});

test('Appium not installed: a plain reason', async () => {
  const { ensureAppium } = await import('../../src/phone/appiumServer');
  await expect(ensureAppium(4723, { listening: async () => false, find: () => undefined, start: () => () => undefined, waitMs: 50 }))
    .rejects.toThrow('Appium is not on this computer - install the phone tools in Trova (Devices) and run again');
});

test('a server that never starts listening is stopped and named in plain words', async () => {
  const { ensureAppium } = await import('../../src/phone/appiumServer');
  let stopped = false;
  await expect(ensureAppium(4723, { listening: async () => false, find: () => ({ node: 'n', main: 'm' }), start: () => () => { stopped = true; }, waitMs: 100 }))
    .rejects.toThrow('Appium did not start within');
  expect(stopped).toBe(true);
});

test("else Windows npm's own global folder (%APPDATA%/npm), where npm -g puts Appium", () => {
  const slash = (p: string) => p.split(String.fromCharCode(92)).join('/');
  const want = 'C:/Users/u/AppData/Roaming/npm/node_modules/appium/build/lib/main.js';
  const found = appiumMain({ APPDATA: 'C:/Users/u/AppData/Roaming' }, 'C:/nodejs/node.exe', (p) => slash(p) === want);
  expect(found && slash(found.main)).toBe(want);
});

test('a suite with a web spec or a Web block needs the run browser; a phone or API suite does not', async () => {
  expect(needsWeb(plan('tests/web/emloyess2/emloyess2.spec.ts'))).toBe(true);
  expect(needsWeb(plan('tests/api/x.spec.ts', ['Web']))).toBe(true);
  expect(needsWeb(plan('tests/mobile/attendance/attendance.spec.ts', ['Mob']))).toBe(false);
  expect(needsWeb(plan('tests/api/overtimeManagement/overtimeManagement.spec.ts'))).toBe(false);
});
