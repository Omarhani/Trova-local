import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseSuite } from '../../src/run/suitePlan';
import { blockingLeftovers, clearLeftovers, leaveToDelete, LeaveStore, webLeaveKey, webLeaveRecords } from '../../src/data/webLeaveLeftovers';
import type { WebLeave } from '../../src/data/webLeave';
import { ownDeleteLeave, webLeaveFor } from '../web/leaveRequests/webLeaveOfRun';

/**
 * Omar 2026-11-12 (Test 8094 run 994): case 4182 made its leave, failed on its toast before it kept the leave for the
 * clean-up, so the leave stayed; case 4189 then asked for a leave on the same days and the app refused it ("يوجد تعارض
 * مع مغادرة مقبولة"). The leave is kept for the clean-up before Save, the suite always deletes the run's leaves, and a
 * case's own leave sits on its own days - a leftover of the run's own kind that blocks it is deleted first, by API.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const KIND = 'Trova web leave';
const LEAVE: WebLeave = { jobNumber: 'J', fullName: 'F', type: 'اجازة', subType: 'سنوية', from: '2026-11-13', to: '2026-11-14', notes: 'Trova web leave r1' };

const row = (ID: number, Notes: string, StatusId: number, FromDate: string, ToDate: string) => ({ ID, Notes, StatusId, FromDate, ToDate });

/** the admin's leaves at the edge: rows by employee, records each delete and add */
function store(rows: ReturnType<typeof row>[], addFails = false) {
  const deleted: string[] = [];
  const added: WebLeave[] = [];
  const api: LeaveStore = {
    rowsOf: async () => rows,
    idByNote: async (_u, note) => {
      const r = rows.find((x) => x.Notes === note && x.StatusId !== 4 && !deleted.includes(String(x.ID)));
      return r ? String(r.ID) : undefined;
    },
    delete: async (id) => { deleted.push(id); },
    add: async (l) => {
      if (addFails) throw new Error('Set-up: the app refused the leave');
      added.push(l);
      return '500';
    },
  };
  return { api, deleted, added };
}

test('a leftover blocks only when it is the run\'s own kind, not deleted, and on the same days', () => {
  const rows = [row(1, 'Trova web leave old', 1, '2026-11-14T00:00:00', '2026-11-15T00:00:00'), // overlaps: blocks
    row(2, 'Trova web leave old', 4, '2026-11-13T00:00:00', '2026-11-14T00:00:00'), // deleted
    row(3, 'someone else\'s leave', 1, '2026-11-13T00:00:00', '2026-11-14T00:00:00'), // not ours: never touched
    row(4, 'Trova web leave far', 1, '2026-11-20T00:00:00', '2026-11-21T00:00:00')]; // other days
  expect(blockingLeftovers(rows, KIND, LEAVE.from, LEAVE.to)).toEqual(['1']);
});

test('set-up deletes the run\'s own leftover that blocks the new leave, and says so', async () => {
  const { api, deleted } = store([row(7, 'Trova web leave old', 1, '2026-11-13', '2026-11-13'), row(8, 'other', 1, '2026-11-13', '2026-11-14')]);
  const said: string[] = [];
  expect(await clearLeftovers(api, 'u-1', LEAVE, KIND, (l) => said.push(l))).toEqual(['7']);
  expect(deleted).toEqual(['7']);
  expect(said.join('\n')).toContain('leftover');
});

test('the clean-up finds the leave by its kept key (employee + note) - kept before Save, so even a failed case has it', async () => {
  const { api } = store([row(9, LEAVE.notes, 1, LEAVE.from, LEAVE.to)]);
  const records = webLeaveRecords(api);
  expect(await records.idOf(webLeaveKey('u-1', LEAVE.notes))).toBe('9');
  await records.delete('9');
  expect(await records.idOf(webLeaveKey('u-1', LEAVE.notes))).toBeUndefined();
});

test('a key whose leave was never made (the case failed before Save) has nothing to delete', async () => {
  const { api } = store([]);
  expect(await webLeaveRecords(api).idOf(webLeaveKey('u-1', 'Trova web leave never'))).toBeUndefined();
});

test('the delete case takes the run\'s leave when it is there', async () => {
  const { api, added } = store([row(11, LEAVE.notes, 1, LEAVE.from, LEAVE.to)]);
  const kept: string[] = [];
  const own = { ...LEAVE, from: '2026-11-16', to: '2026-11-17', notes: 'Trova web leave (delete) r1' };
  expect(await leaveToDelete(api, 'u-1', [webLeaveKey('u-1', LEAVE.notes)], own, KIND, (k) => kept.push(k)))
    .toEqual({ id: '11', key: webLeaveKey('u-1', LEAVE.notes) });
  expect(added).toEqual([]);
});

test('no leave of the run left: the delete case adds its own on its own days, kept before the add even when the add fails', async () => {
  const own = { ...LEAVE, from: '2026-11-16', to: '2026-11-17', notes: 'Trova web leave (delete) r1' };
  const kept: string[] = [];
  const { api } = store([], true);
  await expect(leaveToDelete(api, 'u-1', [webLeaveKey('u-1', 'Trova web leave gone')], own, KIND, (k) => kept.push(k))).rejects.toThrow('refused');
  expect(kept).toEqual([webLeaveKey('u-1', own.notes)]);
});

test('webLeaves-ts.xml deletes the run\'s leaves by API after its cases and before the employee is deleted', () => {
  const names = parseSuite(fs.readFileSync(path.join(ROOT, 'suites', 'webLeaves-ts.xml'), 'utf8')).blocks
    .map((b) => b.tests.map((t) => t.method)[0]);
  const leaves = names.indexOf('cleanUpWebLeavesProgrammatically');
  expect(leaves).toBeGreaterThan(names.indexOf('testVerifyThatTheAdminCanDeleteTheEmployeesLeaveFromTheWeb'));
  expect(leaves).toBeLessThan(names.indexOf('cleanUpEmployeesProgrammatically'));
});

test('the add case keeps its leave for the clean-up before it presses Save', () => {
  const spec = fs.readFileSync(path.join(ROOT, 'tests', 'web', 'leaveRequests', 'adminLeaves.spec.ts'), 'utf8');
  const kept = spec.indexOf('runRecords.keep(MADE_WEB_LEAVES');
  expect(kept).toBeGreaterThan(-1);
  expect(kept).toBeLessThan(spec.indexOf('leaves.addLeave('));
});

test('the delete case\'s own leave never sits on the add case\'s days', () => {
  const e = { firstName: 'A', lastName: 'B', userName: 'u@x', jobNumber: 'J1' } as Parameters<typeof webLeaveFor>[0];
  const add = webLeaveFor(e);
  const own = ownDeleteLeave(e);
  expect(own.from > add.to).toBe(true);
  expect(own.notes).not.toBe(add.notes);
  expect(own.notes.startsWith(KIND)).toBe(true);
});
