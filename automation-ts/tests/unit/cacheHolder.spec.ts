import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { FreeSteps, freeForThisRun, heldOpen, leftoversOn, powerShellPath } from '../../src/web/cacheHolder';

const SLOT = 'C:\\Trova\\automation-ts\\target\\browser-cache\\slot-1';

test('a folder no program holds is free; it stays where it was with its files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-held-unit-'));
  fs.writeFileSync(path.join(dir, 'kept.bin'), 'x');
  try {
    expect(heldOpen(dir)).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'kept.bin'), 'utf8')).toBe('x');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a folder the system refuses to rename is held open by another program', () => {
  const refused = (): void => { throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' }); };
  expect(heldOpen(os.tmpdir(), refused)).toBe(true);
});

test('a folder that is not there yet is free', () => {
  expect(heldOpen(path.join(os.tmpdir(), 'trova-held-none-xyz'))).toBe(false);
});

test('the browser Windows restarted with the kept folder (quoted) is found by its folder', () => {
  const cmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --disk-cache-dir="${SLOT}" --disk-cache-size=268435456 --headless=new --restore-last-session --restart`;
  expect(leftoversOn(SLOT, [{ pid: 2284, cmd }])).toEqual([2284]);
});

test('a browser started by a run (unquoted, forward slashes, other letter case) is found too', () => {
  const cmd = `chrome.exe --disk-cache-dir=c:/trova/automation-ts/target/browser-cache/slot-1 about:blank`;
  expect(leftoversOn(SLOT, [{ pid: 7, cmd }])).toEqual([7]);
});

test('a browser on another kept folder (slot-10) or with none is never taken for this one', () => {
  expect(leftoversOn(SLOT, [
    { pid: 1, cmd: `chrome.exe --disk-cache-dir="${SLOT}0" about:blank` },
    { pid: 2, cmd: 'chrome.exe --type=renderer --user-data-dir=C:\\Temp\\trova-browser-x' },
    { pid: 3, cmd: '' },
  ])).toEqual([]);
});

test('the program list is read with Windows PowerShell by its full place, never through the search path', () => {
  expect(powerShellPath({ SystemRoot: 'C:\\WINDOWS' })).toBe('C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  expect(powerShellPath({})).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});

/** a computer where the folder is held until the leftover browser is stopped */
function computer(o: { held: boolean; leftovers: number[]; freesOnStop: boolean }): FreeSteps & { stopped: number[]; listed: number; said: string[] } {
  let held = o.held;
  const c = {
    stopped: [] as number[], listed: 0, said: [] as string[],
    held: () => held,
    browsers: () => { c.listed += 1; return o.leftovers.map((pid) => ({ pid, cmd: `chrome.exe --disk-cache-dir="${SLOT}"` })); },
    stop: (pid: number) => { c.stopped.push(pid); if (o.freesOnStop) held = false; },
    pause: () => undefined,
    say: (line: string) => { c.said.push(line); },
  };
  return c;
}

test('a free folder is used at once: no program list is read, nothing is stopped', () => {
  const c = computer({ held: false, leftovers: [], freesOnStop: false });
  expect(freeForThisRun(SLOT, c)).toBe(true);
  expect(c.listed).toBe(0);
  expect(c.stopped).toEqual([]);
});

test('a leftover browser on the folder is closed and the folder is used, said in plain words', () => {
  const c = computer({ held: true, leftovers: [2284], freesOnStop: true });
  expect(freeForThisRun(SLOT, c)).toBe(true);
  expect(c.stopped).toEqual([2284]);
  expect(c.said.join(' ')).toMatch(/left open by an earlier run/);
  expect(c.said.join(' ')).not.toMatch(/disk|cache|pid|chrome/i);
});

test('a folder held by a program that is not a Trova browser is left alone and not used', () => {
  const c = computer({ held: true, leftovers: [], freesOnStop: false });
  expect(freeForThisRun(SLOT, c)).toBe(false);
  expect(c.stopped).toEqual([]);
});

test('a folder still held after its leftover browser was closed is not used (waits a limited time)', () => {
  const c = computer({ held: true, leftovers: [9], freesOnStop: false });
  let pauses = 0;
  expect(freeForThisRun(SLOT, { ...c, pause: () => { pauses += 1; } })).toBe(false);
  expect(pauses).toBeGreaterThan(0);
  expect(pauses).toBeLessThanOrEqual(50);
});
