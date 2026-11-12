import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseSuite } from '../../src/run/suitePlan';

const ROOT = path.resolve(__dirname, '..', '..');
const blocks = (file = 'mobLeaveRequest-ts.xml') => parseSuite(fs.readFileSync(path.join(ROOT, 'suites', file), 'utf8')).blocks;
const cases = (file?: string) => blocks(file).filter((b) => b.name.startsWith('Case'));

/**
 * One suite per scenario (owner 2026-11-11): the phone leave suite is Java mob/mobLeaveRequest (send, details while
 * Pending, delete a Pending one); the admin's decisions are Java hybrid/mobFullCycleForLeaves - leaveDecisions-ts.
 */
test("the leave suite: the 3 cases of Java mob/mobLeaveRequest, on the phone as the run's own employee", () => {
  expect(cases().map((b) => b.tests[0].method)).toEqual([
    'testVerifyThatAnEmployeeCanSendALeaveRequestFromThePhoneApp',
    'testVerifyThatThePendingRequestShowsItsDetailsInTheApp',
    'testVerifyThatTheEmployeeCanDeleteAPendingRequestInTheApp',
  ]);
  expect(cases().every((b) => b.groups.includes('Mob'))).toBe(true);
});

test('the admin decisions suite: accept, reject, delete on the web, on an employee this run makes by API', () => {
  const all = blocks('leaveDecisions-ts.xml');
  expect(cases('leaveDecisions-ts.xml').map((b) => b.tests[0].method)).toEqual([
    'testVerifyThatTheAdminCanAcceptALeaveRequestSentFromTheApp',
    'testVerifyThatTheAdminCanRejectALeaveRequestSentFromTheApp',
    'testVerifyThatTheAdminCanDeleteALeaveRequestSentFromTheApp',
  ]);
  expect(cases('leaveDecisions-ts.xml').every((b) => b.groups.includes('Web') && b.params.signedInAs === 'Admin')).toBe(true);
  expect(all.findIndex((b) => b.tests[0].method === 'approvedEmployeeProgrammatically')).toBeLessThan(
    all.findIndex((b) => b.tests[0].method === 'testVerifyThatTheAdminCanAcceptALeaveRequestSentFromTheApp'));
});

test("one sign-in per login: the admin by API first, then the run's employee made by API before the first case", () => {
  const all = blocks();
  expect(all[0].tests[0].method).toBe('logInProgrammatically');
  expect(all[0].tests[0].spec).toBe('tests/api/employeeCycle/employeeSetUp.spec.ts');
  expect(all.filter((b) => /^log in programmatically/i.test(b.name))).toHaveLength(1);
  expect(all[1].name).toBe('Set-up - Create employee by API');
  expect(all[1].tests[0].method).toBe('approvedEmployeeProgrammatically');
});

test("clean-up last, as Java: this run's requests, then the app signed out, then the employee deleted by API", () => {
  expect(blocks().slice(-3).map((b) => b.tests[0].method)).toEqual([
    'cleanUpLeaveRequestsProgrammatically', 'signOutOfTheAppProgrammatically', 'cleanUpEmployeesProgrammatically',
  ]);
});

test('the leave suite runs as a new employee every run - never a saved one (Java makes its own)', () => {
  for (const b of blocks()) expect(b.params.employee_login, b.name).toBeUndefined();
  expect(blocks()[0].params.signedInAs).toBe('Admin');
  expect(blocks()[0].params.employee_tag).toBe('mobLeave');
  expect(blocks()[0].params.employee_password_from).toBe('Mobile user');
});

test("the phone cases keep the app's data (the app opens signed in)", () => {
  for (const b of cases()) expect(b.params.keepAppData, b.name).toBe('true');
  expect(cases()[0].name).toMatch(/^Case \d+ - Verify that an employee can send a leave request from the phone app$/);
});

test('hybrid mode, the employee login, and each case its own note new every run - never a fixed date', () => {
  for (const file of ['mobLeaveRequest-ts.xml', 'leaveDecisions-ts.xml']) {
    for (const b of blocks(file)) expect(b.params.mode ?? 'hybrid', b.name).toBe('hybrid');
    const notes = cases(file).map((b) => b.params.leave_note).filter(Boolean);
    for (const n of notes) expect(n).toContain('{run}');
    expect(new Set(notes).size).toBe(notes.length);
    for (const b of blocks(file)) expect(Object.values(b.params).join(' '), b.name).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  }
});
