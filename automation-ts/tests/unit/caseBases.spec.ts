import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';

/** Round 2: every TS case runs on Trova's base (failure kinds, pre-run stops, no pass without a check) - never the bare one. */

function specs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? specs(p) : e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

test('every case spec takes its test from trovaTest, webTest or phoneTest', () => {
  const root = path.resolve(__dirname, '..');
  const bare = ['api', 'web', 'mobile'].flatMap((side) => specs(path.join(root, side)))
    .filter((f) => /import\s*\{\s*test\b[^}]*\}\s*from\s*'@playwright\/test'/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(root, f));
  expect(bare).toEqual([]);
});
