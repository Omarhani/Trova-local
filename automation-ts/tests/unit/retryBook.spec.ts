import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { RetryBook, retriesFor } from '../../src/run/retryBook';

test("the reporter's decision reaches the retry's own process through the run's file", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tries-')), 'run-tries-1.json');
  const reporter = new RetryBook(() => file);
  reporter.allow('a');
  reporter.keep('b');
  const worker = new RetryBook(() => file);
  expect(worker.allowed('a')).toBe(true);
  expect(worker.allowed('b')).toBe(false);
  expect(worker.allowed('never-seen')).toBe(false);
  worker.forget();
  expect(fs.existsSync(file)).toBe(false);
});

test('Lead 2026-11-11 (house rule): no whole-case retry by default; setUpRetry=once turns the one set-up retry on; TROVA_RETRIES wins', () => {
  expect(retriesFor({}, {})).toBe(0);
  expect(retriesFor({}, { setUpRetry: '' })).toBe(0);
  expect(retriesFor({}, { setUpRetry: 'off' })).toBe(0);
  expect(retriesFor({}, { setUpRetry: 'No' })).toBe(0);
  expect(retriesFor({}, { setUpRetry: 'once' })).toBe(1);
  expect(retriesFor({ TROVA_RETRIES: '0' }, {})).toBe(0);
  expect(retriesFor({ TROVA_RETRIES: '2' }, { setUpRetry: 'off' })).toBe(2);
});
