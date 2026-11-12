import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Round 2 review (test partner), guard G13: set-up records that depend on each other are never made at the same time.
 * Blocks run one at a time, in the suite's order, and no set-up code makes records in parallel - only the clean-up of
 * independent records (cleanUpMade, each its own value) runs at the same time.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const PARALLEL = /Promise\.(all|allSettled|any)\(/;

function files(dir: string): string[] {
  const at = path.join(ROOT, dir);
  if (!fs.existsSync(at)) return [];
  return fs.readdirSync(at, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? files(rel) : e.name.endsWith('.ts') ? [rel] : [];
  });
}

test('the run makes its blocks one at a time, in the suite\'s order', () => {
  const config = fs.readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf8');
  expect(config).toMatch(/workers:\s*1\b/);
  expect(config).toMatch(/fullyParallel:\s*false\b/);
});

test('no set-up code makes records at the same time', () => {
  const parallel = ['src/api', 'src/data', 'tests/api', 'tests/web', 'tests/mobile'].flatMap(files)
    .filter((f) => PARALLEL.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  expect(parallel).toEqual([]);
});
