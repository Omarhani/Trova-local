import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { CACHE_BYTES, CACHE_SLOTS, claimCache } from '../../src/web/browserCache';
import { chromeArgs } from '../../src/web/chromePath';

const roots: string[] = [];

function root(): string {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-cache-unit-'));
  roots.push(r);
  return r;
}

test.afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

const alive = (live: number[]) => (pid: number): boolean => live.includes(pid);

test('a free computer gets the first kept cache folder, inside the cache root', () => {
  const r = root();
  const claim = claimCache(r, 100, alive([100]));
  expect(claim?.dir).toBe(path.join(r, 'slot-1'));
  expect(fs.existsSync(claim!.dir)).toBe(true);
});

test('a folder held by a run that is still going is never shared - the next one is taken', () => {
  const r = root();
  claimCache(r, 100, alive([100, 200]));
  expect(claimCache(r, 200, alive([100, 200]))?.dir).toBe(path.join(r, 'slot-2'));
});

test('a folder left by a run that has ended is taken again (its downloads are kept)', () => {
  const r = root();
  const first = claimCache(r, 100, alive([100]))!;
  fs.writeFileSync(path.join(first.dir, 'kept.bin'), 'x');
  const again = claimCache(r, 300, alive([300]));
  expect(again?.dir).toBe(first.dir);
  expect(fs.existsSync(path.join(again!.dir, 'kept.bin'))).toBe(true);
});

test('every folder busy: no kept cache (the browser starts fresh, as before)', () => {
  const r = root();
  const live = Array.from({ length: CACHE_SLOTS }, (_, i) => i + 1);
  for (const pid of live) expect(claimCache(r, pid, alive(live))).toBeDefined();
  expect(claimCache(r, 999, alive([...live, 999]))).toBeUndefined();
});

test('released at the run end: the next run takes the same folder at once', () => {
  const r = root();
  const claim = claimCache(r, 100, alive([100, 200]))!;
  claim.release();
  expect(claimCache(r, 200, alive([100, 200]))?.dir).toBe(claim.dir);
});

test('a release never frees a folder another run took over', () => {
  const r = root();
  const old = claimCache(r, 100, alive([100]))!;
  const taken = claimCache(r, 200, alive([200]))!; // 100 counted as ended
  old.release();
  expect(taken.dir).toBe(old.dir);
  expect(claimCache(r, 300, alive([200, 300]))?.dir).toBe(path.join(r, 'slot-2'));
});

test('a kept folder another browser still holds is never shared - the next one is taken', () => {
  // runs 972/973: a browser Windows restarted after a reboot held slot-1; a run on it never reused one page file
  const r = root();
  const notSlot1 = (dir: string): boolean => path.basename(dir) !== 'slot-1';
  expect(claimCache(r, 100, alive([100]), notSlot1)?.dir).toBe(path.join(r, 'slot-2'));
});

test('a kept folder skipped as held is not left marked busy for this run', () => {
  const r = root();
  claimCache(r, 100, alive([100]), (dir) => path.basename(dir) !== 'slot-1');
  expect(fs.existsSync(path.join(r, 'slot-1.lock'))).toBe(false);
});

test('every kept folder held by other programs: no kept cache (the browser starts fresh)', () => {
  expect(claimCache(root(), 100, alive([100]), () => false)).toBeUndefined();
});

test('the shared browser keeps its downloads in the claimed folder, size capped', () => {
  const args = chromeArgs(9222, 'P', { width: 1920, height: 1080 }, true, 'C:/cache/slot-1');
  expect(args).toContain('--disk-cache-dir=C:/cache/slot-1');
  expect(args).toContain(`--disk-cache-size=${CACHE_BYTES}`);
  expect(args[args.length - 1]).toBe('about:blank');
});

test('no claimed folder: no cache flags', () => {
  expect(chromeArgs(9222, 'P', { width: 1920, height: 1080 }).some((a) => a.startsWith('--disk-cache'))).toBe(false);
});
