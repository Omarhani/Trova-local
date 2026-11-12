import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { CaseRecords, normCase, normRecord, titleOf } from '../../src/run/caseRecords';
import { RunRecords } from '../../src/run/runRecords';

function fresh(): CaseRecords {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-records-'));
  return new CaseRecords(new RunRecords(path.join(dir, 'records.json')), () => undefined);
}

test('a record made for all is found by any test', () => {
  const records = fresh();
  records.madeForAll("the new employee's user name", 'omar+1@t2.sa');
  expect(records.forTest('testVerifyThatTheAdminCanDeleteTheEmployee', 'Case 342 - x', "the new employee's user name")).toBe('omar+1@t2.sa');
});

test('a record made for one test is found by its method name or its case title', () => {
  const records = fresh();
  records.made('Rejecting with a reason', 'a pending overtime request', '41');
  expect(records.forTest('testRejectingWithAReason', undefined, 'a pending overtime request')).toBe('41');
  expect(records.forTest('other', 'Case 236 - Rejecting with a reason', 'pending overtime request made by this run')).toBe('41');
});

test("a test's own record wins over the shared one", () => {
  const records = fresh();
  records.madeForAll('a request', 'shared');
  records.made('testApproving', 'a request', 'own');
  expect(records.forTest('testApproving', undefined, 'a request')).toBe('own');
});

test('the one record of a test under another record name is still found', () => {
  const records = fresh();
  records.made('testApproving', 'an overtime request', '7');
  expect(records.forTest('testApproving', undefined, 'a request')).toBe('7');
});

test('nothing made = undefined (the test is skipped "Not tested - needs ...")', () => {
  expect(fresh().forTest('testApproving', 'Case 1 - Approving', 'a request')).toBeUndefined();
});

test('a blank value is not made: made refuses it', () => {
  expect(() => fresh().madeForAll('a request', ' ')).toThrow('Not tested - needs a request');
});

test('a later value of the same record replaces the earlier one', () => {
  const records = fresh();
  records.madeForAll('a request', '1');
  records.madeForAll('a request', '2');
  expect(records.forTest('x', undefined, 'a request')).toBe('2');
});

test('names fold: case title prefix, "test", articles and "made by this run" are left out', () => {
  expect(titleOf('Case 12 - Rejecting with a reason')).toBe('Rejecting with a reason');
  expect(titleOf('Case 12, 13: ')).toBeUndefined();
  expect(normCase('testRejectingWithAReason')).toBe(normCase('Rejecting with a reason'));
  expect(normRecord('A pending overtime request made by this run')).toBe(normRecord('pending overtime request'));
});
