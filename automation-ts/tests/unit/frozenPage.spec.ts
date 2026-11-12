import { expect, test } from '@playwright/test';
import { answersWithin, FROZEN, FROZEN_LIMIT_MS, watchFrozen } from '../../src/web/frozenPage';
import { kindOf } from '../../src/report/failureKind';

/**
 * Run 747 (Omar 2026-11-11): after the admin accepted a leave, the page froze (its own script busy) and the case waited
 * the whole 5 minutes; the next cases could not reach the browser. A page that stops answering is closed after the limit
 * - the case ends BLOCKED in plain words, at once.
 */
test('a page that never answers is closed with the plain reason after the limit', async () => {
  let closed = '';
  const page = { evaluate: () => new Promise(() => undefined), close: async (o: { reason: string }) => { closed = o.reason; } };
  const stop = watchFrozen(page as never, { everyMs: 10, limitMs: 60 });
  await new Promise((r) => setTimeout(r, 200));
  stop();
  expect(closed).toBe(FROZEN);
});

test('a page that answers is never closed', async () => {
  let closed = false;
  const page = { evaluate: async () => 1, close: async () => { closed = true; } };
  const stop = watchFrozen(page as never, { everyMs: 10, limitMs: 60 });
  await new Promise((r) => setTimeout(r, 200));
  stop();
  expect(closed).toBe(false);
});

test('the frozen page and a browser that no longer answers are set-up problems in plain words, never FAILED', () => {
  expect(kindOf(`Error: locator.click: Target page, context or browser has been closed: ${FROZEN}`)).toMatchObject({ kind: 'setup', reason: expect.stringContaining('stopped answering') });
  const cdp = kindOf('TimeoutError: browserType.connectOverCDP: Timeout 30000ms exceeded.\nCall log:\n  - <ws preparing> retrieving websocket url from http://127.0.0.1:60941');
  expect(cdp.kind).toBe('setup');
  expect(cdp.reason).toMatch(/^The run's browser stopped answering/);
});

test('runs 750 / 752: a page busy loading (its answers are errors while it navigates) is alive - never closed', async () => {
  let closed = false;
  const page = { evaluate: async () => { throw new Error('Execution context was destroyed, most likely because of a navigation'); }, close: async () => { closed = true; } };
  const stop = watchFrozen(page as never, { everyMs: 10, limitMs: 60 });
  await new Promise((r) => setTimeout(r, 200));
  stop();
  expect(closed).toBe(false);
});

test('run 755: a page asked once answers within the limit - true; a frozen one - false', async () => {
  expect(await answersWithin({ evaluate: async () => 1 } as never, 50)).toBe(true);
  expect(await answersWithin({ evaluate: async () => { throw new Error('navigating'); } } as never, 50)).toBe(true);
  expect(await answersWithin({ evaluate: () => new Promise(() => undefined) } as never, 50)).toBe(false);
});

test('run 762: the default limit is the house\'s 60 s - the leave page is busy 20+ s on its first load and is alive', () => {
  expect(FROZEN_LIMIT_MS).toBe(60_000);
  expect(FROZEN).toContain('for 60 s');
});

test('run 790: a page the watch already closed (it froze) is not "answering" - its error says it is closed', async () => {
  const closed = { evaluate: async () => { throw new Error('page.evaluate: Target page, context or browser has been closed'); } };
  expect(await answersWithin(closed as never, 50)).toBe(false);
});
