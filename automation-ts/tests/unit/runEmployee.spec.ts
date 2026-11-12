import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { RunRecords } from '../../src/run/runRecords';
import { RunEmployees } from '../../src/run/runEmployee';

function fresh(): RunEmployees {
  return new RunEmployees(new RunRecords(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 're-')), 'records.json')));
}

const OMAR = { firstName: 'Omar', lastName: 'CycleAB', userName: 'o+cycle@t2.sa', jobNumber: 'CYCLE01' };

test('no employee made yet: none current, nothing to clean up', () => {
  const run = fresh();
  expect(run.current()).toBeUndefined();
  expect(run.madeUserNames()).toEqual([]);
});

test('a kept employee is the current one and its user name is kept for the clean-up', () => {
  const run = fresh();
  run.keep({ ...OMAR, id: 'u-1' });
  expect(run.current()).toEqual({ ...OMAR, id: 'u-1' });
  expect(run.madeUserNames()).toEqual(['o+cycle@t2.sa']);
});

test('keeping the same employee again updates it and does not clean it up twice', () => {
  const run = fresh();
  run.keep(OMAR);
  run.keep({ ...OMAR, id: 'u-2' });
  expect(run.current()?.id).toBe('u-2');
  expect(run.madeUserNames()).toEqual(['o+cycle@t2.sa']);
});

test('the newest employee is current; the clean-up gets every one, newest first', () => {
  const run = fresh();
  run.keep(OMAR);
  run.keep({ ...OMAR, userName: 'o+two@t2.sa' });
  expect(run.current()?.userName).toBe('o+two@t2.sa');
  expect(run.madeUserNames()).toEqual(['o+two@t2.sa', 'o+cycle@t2.sa']);
});

test('a deleted employee is forgotten: no longer current, not cleaned up again', () => {
  const run = fresh();
  run.keep(OMAR);
  run.forget(OMAR.userName);
  expect(run.current()).toBeUndefined();
  expect(run.madeUserNames()).toEqual([]);
});

test('the changed-password mark is per employee and keeps no password', () => {
  const run = fresh();
  run.keep(OMAR);
  expect(run.passwordChanged(OMAR.userName)).toBe(false);
  run.markPasswordChanged(OMAR.userName);
  expect(run.passwordChanged(OMAR.userName)).toBe(true);
  expect(run.passwordChanged('o+other@t2.sa')).toBe(false);
});

test('nothing secret is written: the records file holds no password field', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 're-')), 'records.json');
  const run = new RunEmployees(new RunRecords(file));
  run.keep(OMAR);
  run.markPasswordChanged(OMAR.userName);
  expect(fs.readFileSync(file, 'utf8').toLowerCase()).not.toContain('password"');
});

test('run 688: a set-up that could not make the employee is kept with its reason - its cases are BLOCKED, never made again quietly', () => {
  const run = fresh();
  expect(run.setUpFailed()).toBeUndefined();
  run.markSetUpFailed('The call /api/Account/GetAccountIdByCode did not answer (ETIMEDOUT: connect)');
  expect(run.setUpFailed()).toContain('ETIMEDOUT');
});
