import { expect, test } from '@playwright/test';
import { EventEmitter } from 'node:events';
import { CallsInFlight } from '../../src/web/callsInFlight';

/**
 * Run 721 (Omar 2026-11-11): after "Show again" the page's first, slower list load (every employee) came back after the
 * filtered one and replaced the table - the edit hit another employee's row. The page counts its list calls in flight
 * and acts only when none is left.
 */
const req = (url: string) => ({ url: () => url });

test('counts only the matching calls, from start to finish or failure', () => {
  const page = new EventEmitter();
  const calls = new CallsInFlight(page as never, /GetUsersTransactionCorrections/);
  page.emit('request', req('https://x/api/Reports/GetUsersTransactionCorrections'));
  page.emit('request', req('https://x/api/Reports/GetUsersTransactionCorrections'));
  page.emit('request', req('https://x/api/Department/GetAll'));
  expect(calls.count).toBe(2);
  page.emit('requestfinished', req('https://x/api/Reports/GetUsersTransactionCorrections'));
  expect(calls.count).toBe(1);
  page.emit('requestfailed', req('https://x/api/Reports/GetUsersTransactionCorrections'));
  expect(calls.count).toBe(0);
});

test('never below zero (a call that started before the page object was made)', () => {
  const page = new EventEmitter();
  const calls = new CallsInFlight(page as never, /Corrections/);
  page.emit('requestfinished', req('https://x/Corrections'));
  expect(calls.count).toBe(0);
});

test('run 723: idle answers at once with none in flight, when the last one ends, or false at the limit', async () => {
  const page = new EventEmitter();
  const calls = new CallsInFlight(page as never, /Corrections/);
  expect(await calls.idle(50)).toBe(true);
  page.emit('request', req('https://x/Corrections'));
  const waiting = calls.idle(5000);
  page.emit('requestfinished', req('https://x/Corrections'));
  expect(await waiting).toBe(true);
  page.emit('request', req('https://x/Corrections'));
  expect(await calls.idle(50)).toBe(false);
});
