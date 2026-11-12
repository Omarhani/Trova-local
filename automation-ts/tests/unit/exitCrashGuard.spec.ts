import { spawnSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { EXIT_SAFE_FLAG, guardExit } from '../../src/run/exitCrashGuard';

/**
 * Test 8094 runs 614-616: "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" when a TS process ended. Node 24 on
 * Windows: after a few calls with Node's fetch its HTTP reader (WebAssembly) is recompiled in the background, and a
 * process that exits while that runs crashes (3 calls then exit: 3 of 3 crashed; with the guard 0 of 5).
 */
const CALLS_THEN_EXIT = `
const http = require('node:http');
const srv = http.createServer((q, s) => s.end('{}'));
srv.listen(0, '127.0.0.1', async () => {
  for (let i = 0; i < 10; i++) await (await fetch('http://127.0.0.1:' + srv.address().port + '/')).text();
  process.exit(0);
});`;

test('the guard keeps Node\'s HTTP reader from being recompiled in the background', () => {
  const set: string[] = [];
  guardExit((flag) => set.push(flag));
  expect(set).toEqual(['--no-wasm-dynamic-tiering']);
});

test('a process that made calls and exits at once does not crash with the guard (Test 8094 run 616)', () => {
  const script = `require('node:v8').setFlagsFromString(${JSON.stringify(EXIT_SAFE_FLAG)});${CALLS_THEN_EXIT}`;
  for (let i = 0; i < 3; i++) {
    const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 30_000 });
    expect(`${run.stdout}${run.stderr}`).not.toContain('Assertion failed');
    expect(run.status).toBe(0);
  }
});
