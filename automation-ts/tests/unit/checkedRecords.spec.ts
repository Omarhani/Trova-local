import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { madeChecked } from '../../src/records/checkedSetUp';
import { cleanUpKind, cleanUpRun, Lines } from '../../src/records/cleanUpByIds';
import { MadeRecords } from '../../src/records/madeRecords';
import { Made, RecordKind } from '../../src/records/recordKind';
import { signInLine } from '../../src/records/signInLine';
import { RunRecords } from '../../src/run/runRecords';

/** Omar 2026-11-13 (run 1033): set-up by API is a checked step, clean-up deletes exactly this run's ids and proves them gone */

function records(): MadeRecords {
  return new MadeRecords(new RunRecords(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'made-')), 'records.json')));
}

function said(): Lines & { ok: string[]; bad: string[] } {
  const ok: string[] = [];
  const bad: string[] = [];
  return { ok, bad, pass: (l) => ok.push(l), fail: (l) => bad.push(l) };
}

/** a fake app: ids in it, a delete answer, and ids it keeps after a delete */
function plans(there: Set<string>, answer = { ok: true, status: 200, message: '' }, stays = new Set<string>()): RecordKind & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    key: 'plans', noun: 'work plan', deleted,
    delete: async (m: Made) => {
      deleted.push(m.id);
      if (answer.ok && !stays.has(m.id)) there.delete(m.id);
      return answer;
    },
    isThere: async (m: Made) => there.has(m.id),
  };
}

test('a delete that answers an error FAILS with the app\'s status and words', async () => {
  const r = records();
  r.keep({ key: 'plans', noun: 'work plan' }, '7');
  const lines = said();
  const failures = await cleanUpKind(plans(new Set(['7']), { ok: false, status: 400, message: 'The plan has shifts' }), r, lines);
  expect(failures).toEqual(['Expected: work plan id 7 deleted / Actual: HTTP 400 - The plan has shifts']);
  expect(lines.bad).toEqual(failures);
  expect(lines.ok).toEqual([]);
  expect(r.made({ key: 'plans', noun: 'work plan' })).toEqual(['7']);
});

test('a record still there after its delete FAILS - the follow-up read decides, not the delete answer', async () => {
  const r = records();
  r.keep({ key: 'plans', noun: 'work plan' }, '7');
  const lines = said();
  const failures = await cleanUpKind(plans(new Set(['7']), undefined, new Set(['7'])), r, lines);
  expect(failures).toEqual(['Expected: work plan id 7 is gone / Actual: it is still there after the delete']);
  await expect(cleanUpRun([plans(new Set(['7']), undefined, new Set(['7']))], r, said())).rejects.toThrow('still there');
});

test('every record made is deleted by its id, one line each, and only those', async () => {
  const r = records();
  r.keep({ key: 'plans', noun: 'work plan' }, '7');
  r.keep({ key: 'plans', noun: 'work plan' }, '8');
  const there = new Set(['7', '8', '99']);
  const kind = plans(there);
  const lines = said();
  expect(await cleanUpKind(kind, r, lines)).toEqual([]);
  expect(kind.deleted).toEqual(['8', '7']);
  expect(there).toEqual(new Set(['99']));
  expect(lines.ok).toEqual(['Deleted work plan id 8', 'Deleted work plan id 7']);
  expect(r.made(kind)).toEqual([]);
});

test('nothing made = one line "Nothing to delete - this run made no <record>", and nothing is called', async () => {
  const kind = plans(new Set(['1']));
  const lines = said();
  expect(await cleanUpKind(kind, records(), lines)).toEqual([]);
  expect(lines.ok).toEqual(['Nothing to delete - this run made no work plan']);
  expect(kind.deleted).toEqual([]);
});

test('run 1033: a record the test deleted itself is read back, never claimed gone without the read', async () => {
  const r = records();
  const key = { key: 'plans', noun: 'work plan' };
  r.keep(key, '7');
  r.deletedByTest(key, '7');
  const lines = said();
  expect(await cleanUpKind(plans(new Set()), r, lines)).toEqual([]);
  expect(lines.ok).toEqual(['Nothing to delete - the test already deleted work plan id 7 (read back: gone)']);
  const still = plans(new Set(['7']));
  r.deletedByTest(key, '7');
  expect(await cleanUpKind(still, r, said())).toEqual([]);
  expect(still.deleted).toEqual(['7']); // still there: deleted now like any record of the run
});

test('a record kept by its name is deleted by the id it has now', async () => {
  const r = records();
  r.keep({ key: 'plans', noun: 'work plan' }, 'Omar WebPlan 1033');
  const kind = { ...plans(new Set(['41'])), idOf: async (name: string) => (name === 'Omar WebPlan 1033' ? { entry: name, id: '41' } : undefined) };
  const lines = said();
  expect(await cleanUpKind(kind, r, lines)).toEqual([]);
  expect(lines.ok).toEqual(['Deleted work plan id 41']);
});

test('set-up: the create call must answer ok and an id - its line shows the id', () => {
  const r = records();
  const lines = said();
  expect(madeChecked({ key: 'emp', noun: 'employee' }, { ok: true, status: 200, message: '', id: '512' }, undefined, r, lines)).toBe('512');
  expect(lines.ok).toEqual(['Made employee id 512']);
  expect(r.made({ key: 'emp', noun: 'employee' })).toEqual(['512']);
});

test('set-up: a refused create FAILS with "Expected: the <record> is made / Actual: <status + app message>"', () => {
  const r = records();
  expect(() => madeChecked({ key: 'emp', noun: 'employee' }, { ok: false, status: 409, message: 'User name is taken' }, 'ali', r, said()))
    .toThrow('Expected: the employee is made / Actual: HTTP 409 - User name is taken');
  expect(r.made({ key: 'emp', noun: 'employee' })).toEqual([]);
});

test('set-up: an ok answer with no id FAILS, and a record kept by its name is still cleaned up', () => {
  const r = records();
  expect(() => madeChecked({ key: 'emp', noun: 'employee' }, { ok: true, status: 200, message: '', id: '' }, 'ali', r, said()))
    .toThrow('Expected: the employee is made / Actual: HTTP 200 - the answer has no id');
  expect(r.made({ key: 'emp', noun: 'employee' })).toEqual(['ali']);
});

test('the sign-in line names the user and the way', () => {
  expect(signInLine('Admin', 'api')).toBe('Sign in as Admin (by API)');
  expect(signInLine('Account manager over Time', 'screens')).toBe('Sign in as Account manager over Time (by screens)');
});
