import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { leaveRequestKind } from '../../src/api/records/leaveRequestKind';
import { LEAVE_REQUEST } from '../../src/api/records/recordKeys';
import type { LeaveRow } from '../../src/api/services/leaveRequestsApi';
import { appSignInExtra } from '../../src/phone/phoneSignInSteps';
import { cleanUpKind, Lines } from '../../src/records/cleanUpByIds';
import { MadeRecords } from '../../src/records/madeRecords';
import { signInLine, signInStep, signOutStep } from '../../src/records/signInLine';
import { RunRecords } from '../../src/run/runRecords';

/** Omar 2026-11-13, round 2.2 phone suite: the phone's leave clean-up by id and its sign-in / sign-out lines */

function records(): MadeRecords {
  return new MadeRecords(new RunRecords(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'made-')), 'records.json')));
}

function said(): Lines & { ok: string[]; bad: string[] } {
  const ok: string[] = [];
  const bad: string[] = [];
  return { ok, bad, pass: (l) => ok.push(l), fail: (l) => bad.push(l) };
}

/** the employee's own leave list on the phone API */
function leaves(rows: LeaveRow[], refuse = '') {
  const deleted: string[] = [];
  return {
    deleted,
    list: async () => rows,
    delete: async (id: number | string) => {
      deleted.push(String(id));
      if (refuse) throw new Error(`Leaves/Delete answered HTTP 400: ${refuse}`);
      rows.splice(rows.findIndex((r) => String(r.ID) === String(id)), 1);
    },
  };
}

const row = (ID: number, Notes: string): LeaveRow => ({ ID, Notes, StatusId: 2 } as unknown as LeaveRow);

test('the leave request this run sent is deleted by its id and read back gone - "Deleted leave request id 55"', async () => {
  const r = records();
  r.keep(LEAVE_REQUEST, 'ali|Trova leave 1050');
  const api = leaves([row(55, 'Trova leave 1050'), row(9, 'not ours')]);
  const lines = said();
  expect(await cleanUpKind(leaveRequestKind(async (u) => (u === 'ali' ? api : undefined)), r, lines)).toEqual([]);
  expect(api.deleted).toEqual(['55']);
  expect(lines.ok).toEqual(['Deleted leave request id 55']);
});

test('a refused leave delete FAILS; a request of an employee the run no longer has FAILS, never passes quietly', async () => {
  const r = records();
  r.keep(LEAVE_REQUEST, 'ali|Trova leave 1050');
  r.keep(LEAVE_REQUEST, 'omar|Trova leave 1049');
  const api = leaves([row(55, 'Trova leave 1050')], 'not allowed');
  const lines = said();
  const failures = await cleanUpKind(leaveRequestKind(async (u) => (u === 'ali' ? api : undefined)), r, lines);
  expect(failures).toHaveLength(2);
  expect(failures.join('\n')).toContain('Expected: leave request id 55 deleted / Actual: HTTP 400');
  expect(failures.join('\n')).toContain('the run no longer has the employee omar');
});

test('nothing sent = "Nothing to delete - this run made no leave request"', async () => {
  const lines = said();
  expect(await cleanUpKind(leaveRequestKind(async () => undefined), records(), lines)).toEqual([]);
  expect(lines.ok).toEqual(['Nothing to delete - this run made no leave request']);
});

test('the phone sign-in names the user and the way, as a step (never a check)', () => {
  expect(signInLine('ali', 'app')).toBe("Sign in as ali (on the app's screens)");
  const steps: Record<string, unknown>[] = [];
  signInStep('ali', 'api', "this run's sign-in reused", (_t, f) => steps.push(f));
  signOutStep('ali', 'the app is closed with its data cleared', (_t, f) => steps.push(f));
  expect(steps.map((s) => `${s.a} ${s.e}`)).toEqual([
    "Sign in as ali (by API) - this run's sign-in reused",
    'Sign out ali - the app is closed with its data cleared',
  ]);
});

test('the app\'s sign-in line says only what the screens did', () => {
  expect(appSignInExtra(new Set(['accountCode', 'credentials', 'login']))).toBe('');
  expect(appSignInExtra(new Set(['verified']))).toBe('the app was already signed in as this user');
});
