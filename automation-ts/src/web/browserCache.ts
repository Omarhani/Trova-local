import * as fs from 'node:fs';
import * as path from 'node:path';
import { freeForThisRun } from './cacheHolder';

/** how many runs on one computer can each keep their own downloads at the same time */
export const CACHE_SLOTS = 3;
/** the most a kept folder may hold (Chrome drops the oldest files past it) */
export const CACHE_BYTES = 256 * 1024 * 1024;

/** a kept download folder this run holds; release = give it back at the run end */
export interface CacheClaim {
  dir: string;
  release: () => void;
}

/** where the run's browser keeps the app's downloads between runs */
export function cacheRoot(): string {
  return path.resolve(__dirname, '..', '..', 'target', 'browser-cache');
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * A folder for the browser's downloads (the app's scripts, styles, pictures) kept between runs - Test 8094 run 612: a
 * fresh browser downloaded the whole app again, 7 s before its sign-in page showed against 1.5 s with them kept, and
 * again on each page's first visit. Only the browser's download cache: never its sign-in, cookies or storage (every
 * run still starts with an empty profile). One run per folder at a time; a folder whose run has ended is taken again.
 * undefined = every folder is busy (the browser starts with no kept downloads, as before). Runs 972/973: a folder another
 * browser still holds is never shared - two browsers on one folder reuse none of its files (free: cacheHolder).
 */
export function claimCache(root: string, pid = process.pid, alive: (pid: number) => boolean = isAlive,
                           free: (dir: string) => boolean = freeForThisRun): CacheClaim | undefined {
  fs.mkdirSync(root, { recursive: true });
  for (let n = 1; n <= CACHE_SLOTS; n++) {
    const dir = path.join(root, `slot-${n}`);
    const lock = `${dir}.lock`;
    if (!take(lock, pid, alive)) continue;
    if (!free(dir)) {
      release(lock, pid);
      continue;
    }
    fs.mkdirSync(dir, { recursive: true });
    return { dir, release: () => release(lock, pid) };
  }
  return undefined;
}

/** the lock written with this run's pid; one held by a run that has ended is taken over */
function take(lock: string, pid: number, alive: (pid: number) => boolean): boolean {
  if (write(lock, pid)) return true;
  const holder = Number(read(lock));
  if (holder === pid || (Number.isInteger(holder) && holder > 0 && alive(holder))) return false;
  fs.rmSync(lock, { force: true });
  return write(lock, pid);
}

function write(lock: string, pid: number): boolean {
  try {
    fs.writeFileSync(lock, String(pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function read(lock: string): string {
  try {
    return fs.readFileSync(lock, 'utf8').trim();
  } catch {
    return '';
  }
}

/** given back only while this run still holds it */
function release(lock: string, pid: number): void {
  if (read(lock) === String(pid)) fs.rmSync(lock, { force: true });
}
