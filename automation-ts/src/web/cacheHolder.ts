import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { emit } from '../report/liveEvents';

/** a browser program running on this computer: its id and how it was started */
export interface Running {
  pid: number;
  cmd: string;
}

/** what freeForThisRun needs from the computer (real ones by default, own ones in unit tests) */
export interface FreeSteps {
  held: (dir: string) => boolean;
  browsers: () => Running[];
  stop: (pid: number) => void;
  pause: (ms: number) => void;
  say: (line: string) => void;
}

/** how long a closed leftover browser may take to let go of the folder */
const LET_GO_MS = 10_000;
const LOOK_EVERY_MS = 200;

/**
 * true when another program still has files of dir open: Windows refuses to rename such a folder (runs 972/973 - a
 * browser Windows restarted after a reboot held kept folder slot-1 for days). Elsewhere a rename always works: false.
 */
export function heldOpen(dir: string, rename: (from: string, to: string) => void = fs.renameSync): boolean {
  if (!fs.existsSync(dir)) return false;
  const probe = `${dir}.look-${process.pid}`;
  try {
    rename(dir, probe);
  } catch {
    return true;
  }
  rename(probe, dir);
  return false;
}

const plain = (s: string): string => s.replace(/["']/g, '').replace(/\//g, '\\').toLowerCase();

/** the browsers started with dir as their kept folder - Trova's own (a run's, or one restarted after a reboot) */
export function leftoversOn(dir: string, running: Running[]): number[] {
  const flag = `--disk-cache-dir=${plain(dir)}`;
  return running.filter((r) => {
    const cmd = plain(r.cmd);
    const at = cmd.indexOf(flag);
    return at >= 0 && /^(\s|$)/.test(cmd.slice(at + flag.length));
  }).map((r) => r.pid);
}

/** Windows PowerShell by its full place: a run's search path may be cut short (this PC's PATH is at its limit) */
export function powerShellPath(env: Record<string, string | undefined> = process.env): string {
  return `${env.SystemRoot ?? env.windir ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

/** Chrome and Edge programs running now (Windows: their start lines; elsewhere none - a folder is never held there) */
export function runningBrowsers(platform = process.platform): Running[] {
  if (platform !== 'win32') return [];
  try {
    const out = execFileSync(powerShellPath(), ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\' OR Name=\'msedge.exe\'" | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }'],
    { encoding: 'utf8', timeout: 20_000, windowsHide: true });
    return out.split(/\r?\n/).map((line) => line.split('|')).filter((p) => /^\d+$/.test(p[0] ?? ''))
      .map(([pid, ...cmd]) => ({ pid: Number(pid), cmd: cmd.join('|') }));
  } catch {
    return [];
  }
}

const REAL: FreeSteps = {
  held: (dir) => heldOpen(dir),
  browsers: () => runningBrowsers(),
  stop: (pid) => { try { process.kill(pid); } catch { /* already gone */ } },
  pause: (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); },
  say: (line) => emit('log', { text: line }),
};

/**
 * The kept folder can be this run's alone: no program holds it, or the Trova browser left on it (its run ended, or
 * Windows restarted it after a reboot) is closed first. A folder held by anything else is never used (false).
 */
export function freeForThisRun(dir: string, steps: FreeSteps = REAL): boolean {
  if (!steps.held(dir)) return true;
  const left = leftoversOn(dir, steps.browsers());
  if (left.length === 0) return false;
  left.forEach((pid) => steps.stop(pid));
  for (let waited = 0; waited < LET_GO_MS; waited += LOOK_EVERY_MS) {
    steps.pause(LOOK_EVERY_MS);
    if (!steps.held(dir)) {
      steps.say('A browser left open by an earlier run still held the page files Trova keeps between runs - Trova closed it, so this run reuses them');
      return true;
    }
  }
  return false;
}
