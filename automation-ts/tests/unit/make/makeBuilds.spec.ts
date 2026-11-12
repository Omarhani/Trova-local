import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Draft } from '../../../src/make/draft';
import { made, ROOT } from './makeFixtures';

/**
 * Make automation - what Trova writes builds with the project's own code: each kind's draft is laid over a copy of
 * src/ (git-ignored, under target/) and the project's own TypeScript check runs once over all of them.
 */
const KINDS = ['webUi', 'phone', 'hybrid', 'api', 'reuse', 'secrets'];
const WORK = path.join(ROOT, 'target', 'make-check');

function layOut(kind: string, d: Draft): void {
  const tree = path.join(WORK, kind);
  fs.cpSync(path.join(ROOT, 'src'), path.join(tree, 'src'), { recursive: true });
  for (const f of [...d.files, d.spec, d.trap]) {
    const to = path.join(tree, f.path);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, f.text, 'utf8');
  }
}

test('every kind\'s draft builds with the project\'s own code', () => {
  test.setTimeout(240_000);
  fs.rmSync(WORK, { recursive: true, force: true });
  for (const kind of KINDS) {
    const d = made(kind);
    expect(d.refused, kind).toBeUndefined();
    expect(d.spec.path, kind).toMatch(/^tests\/\w+\/\w+\/\w+\.spec\.ts$/);
    layOut(kind, d);
  }
  fs.writeFileSync(path.join(WORK, 'tsconfig.json'), JSON.stringify({
    extends: '../../tsconfig.json', compilerOptions: { noEmit: true }, include: ['*/src/**/*.ts', '*/tests/**/*.ts'],
  }), 'utf8');
  const tsc = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', path.join(WORK, 'tsconfig.json')],
    { encoding: 'utf8', timeout: 220_000 });
  expect(`${tsc.stdout}${tsc.stderr}`.trim()).toBe('');
  expect(tsc.status).toBe(0);
});
