import { EventEmitter } from 'node:events';
import { expect, test } from '@playwright/test';
import { stopBrowser } from '../../src/web/browserStop';

/** a started browser as the run holds it: kill() asks it to stop, 'exit' says it has */
class FakeBrowser extends EventEmitter {
  exitCode: number | null = null;
  killed = 0;
  constructor(private readonly exitsAfterMs: number | undefined) { super(); }
  kill(): boolean {
    this.killed++;
    if (this.exitsAfterMs !== undefined) setTimeout(() => { this.exitCode = 0; this.emit('exit', 0); }, this.exitsAfterMs);
    return true;
  }
}

test('the run ends only after the browser has really stopped, then its profile goes and its folder is given back', async () => {
  const done: string[] = [];
  const b = new FakeBrowser(300);
  await stopBrowser(b, { removeProfile: () => { done.push(b.exitCode === null ? 'profile while running' : 'profile'); },
    release: () => done.push('release'), waitMs: 5000 });
  expect(b.killed).toBe(1);
  expect(done).toEqual(['profile', 'release']);
});

test('a profile that cannot be removed never stops the folder from being given back, and never throws', async () => {
  const done: string[] = [];
  await stopBrowser(new FakeBrowser(10), { removeProfile: () => { throw new Error('EBUSY'); }, release: () => done.push('release'), waitMs: 5000 });
  expect(done).toEqual(['release']);
});

test('a browser that does not stop in time: given up after the wait, the folder still given back', async () => {
  const done: string[] = [];
  const start = Date.now();
  await stopBrowser(new FakeBrowser(undefined), { removeProfile: () => undefined, release: () => done.push('release'), waitMs: 300 });
  expect(Date.now() - start).toBeLessThan(2000);
  expect(done).toEqual(['release']);
});

test('a browser that had already stopped is not waited for', async () => {
  const b = new FakeBrowser(undefined);
  b.exitCode = 0;
  const start = Date.now();
  await stopBrowser(b, { removeProfile: () => undefined, release: () => undefined, waitMs: 5000 });
  expect(Date.now() - start).toBeLessThan(500);
});
