import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { fresh } from '../../src/run/runStamp';
import { RunRecords } from '../../src/run/runRecords';

test('{run} and {run:340} take the run stamp', () => {
  expect(fresh('omar.tc01+{run:340}@t2saas.sa', 'a1b2c3')).toBe('omar.tc01+a1b2c3@t2saas.sa');
  expect(fresh('TC3110A{run}', 'a1b2c3')).toBe('TC3110Aa1b2c3');
});

test('a value without a stamp stays as it is', () => {
  expect(fresh('QA', 'a1b2c3')).toBe('QA');
});

test('records come back newest first and only for their key', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rr-')), 'records.json');
  const records = new RunRecords(file);
  records.keep('jobs', 'A');
  records.keep('jobs', 'B');
  records.keep('other', 'C');
  expect(new RunRecords(file).newestFirst('jobs')).toEqual(['B', 'A']);
});

test('a forgotten record is not cleaned up again', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rr-')), 'records.json');
  const records = new RunRecords(file);
  records.keep('jobs', 'A');
  records.forget('jobs', 'A');
  expect(records.newestFirst('jobs')).toEqual([]);
});

test('a key nothing was kept under gives an empty list', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rr-')), 'records.json');
  expect(new RunRecords(file).newestFirst('none')).toEqual([]);
});
