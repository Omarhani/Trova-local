import { expect, test } from '@playwright/test';
import { prepareRun, RunParts } from '../../src/run/runParts';

/** Round 2 review (R1-21): a run never leaves its browser or phone server running - not after a failed check, not after a file error. */

function parts(over: Partial<RunParts> = {}) {
  const log: string[] = [];
  const p: RunParts = {
    forgetFiles: () => log.push('forget files'),
    startBrowser: async () => { log.push('browser'); return async () => { log.push('close browser'); }; },
    startPhoneServer: async () => { log.push('phone server'); return () => { log.push('stop phone server'); }; },
    checkBeforeRun: async () => { log.push('check'); },
    warmPhone: () => { log.push('warm'); return Promise.resolve(); },
    endPhone: async () => { log.push('end phone'); },
    stopPhoneCases: (why) => { log.push(`stop phone cases: ${why}`); },
    say: () => undefined,
    ...over,
  };
  return { p, log };
}

test('a before-run check that breaks closes the browser and the phone server it started, then fails the run', async () => {
  const { p, log } = parts({ checkBeforeRun: async () => { throw new Error('check broke'); } });
  await expect(prepareRun(p)).rejects.toThrow('check broke');
  expect(log).toContain('close browser');
  expect(log).toContain('stop phone server');
});

test('item 10: a phone server that does not start is tried once more; it starts - the run goes on', async () => {
  let starts = 0;
  const { p, log } = parts({ startPhoneServer: async () => {
    if (++starts === 1) throw new Error('Appium did not start within 120 s - see target/appium.log');
    log.push('phone server'); return () => { log.push('stop phone server'); };
  } });
  const end = await prepareRun(p);
  expect(starts).toBe(2);
  expect(log.some((l) => l.startsWith('stop phone cases'))).toBe(false);
  await end();
  expect(log).toContain('stop phone server');
});

test('item 10: a phone server that does not start twice stops the phone cases with a plain reason - never "no test ran"', async () => {
  const { p, log } = parts({ startPhoneServer: async () => { throw new Error('Appium did not start within 120 s - see target/appium.log'); } });
  const end = await prepareRun(p); // the run goes on: its API cases and clean-up still run
  const stop = log.find((l) => l.startsWith('stop phone cases'));
  expect(stop).toContain('did not start');
  expect(stop).toContain('tried twice');
  expect(log.indexOf('check')).toBeLessThan(log.indexOf(stop!)); // after the before-run check, so it is kept
  await end();
  expect(log).toContain('close browser');
});

test("the run's end closes the phone and the browser BEFORE its files go, and a file error never leaves them running", async () => {
  let calls = 0;
  const { p, log } = parts({ forgetFiles: () => { calls++; log.push('forget files'); if (calls > 1) throw new Error('file locked'); } });
  const end = await prepareRun(p);
  await expect(end()).rejects.toThrow('file locked');
  const after = log.slice(log.lastIndexOf('warm') + 1);
  expect(after).toEqual(['end phone', 'stop phone server', 'close browser', 'forget files']);
});
