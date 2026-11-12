import { expect, test } from '@playwright/test';
import { endEvent, liveLine, statusOf } from '../../src/report/liveEvents';

test('a live line is ASCII only - Arabic goes as \\u escapes, like the Java feed', () => {
  const line = liveLine({ t: 'check', d: 'تمت' });
  expect(line.startsWith('@@live {')).toBe(true);
  expect(/^[\x00-\x7f]*$/.test(line)).toBe(true);
  expect(JSON.parse(line.slice('@@live '.length)).d).toBe('تمت');
});

test('Playwright results map to the run statuses Trova knows', () => {
  expect(statusOf('passed')).toBe('pass');
  expect(statusOf('failed')).toBe('fail');
  expect(statusOf('timedOut')).toBe('fail');
  expect(statusOf('interrupted')).toBe('fail');
  expect(statusOf('skipped')).toBe('skip');
});

test('the end event carries the first error in plain text, colour codes taken out and capped at 400', () => {
  const e = endEvent('failed', ['\u001b[31mExpected 3\u001b[39m' + 'x'.repeat(500)]);
  expect(e.status).toBe('fail');
  expect(String(e.msg).startsWith('Expected 3x')).toBe(true);
  expect(String(e.msg).length).toBeLessThanOrEqual(401);
});

test('a skipped test keeps its reason (Not tested - needs ...)', () => {
  expect(endEvent('skipped', [], 'Not tested - needs the new employee').msg).toBe('Not tested - needs the new employee');
});
