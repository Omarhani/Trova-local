import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseSuite } from '../../src/run/suitePlan';

const ROOT = path.resolve(__dirname, '..', '..');
const SUITES = path.join(ROOT, 'suites');

function suite(file: string) {
  return parseSuite(fs.readFileSync(path.join(SUITES, file), 'utf8'));
}

/** the test names a spec file declares: test('name', ...) */
function testNames(spec: string): string[] {
  const text = fs.readFileSync(path.join(ROOT, spec), 'utf8');
  return [...text.matchAll(/\btest\(\s*'([^']+)'/g)].map((m) => m[1]);
}

for (const file of fs.readdirSync(SUITES).filter((f) => f.endsWith('-ts.xml'))) {
  test(`${file}: every block names a TS spec that exists and has the test`, () => {
    for (const block of suite(file).blocks) {
      expect(block.tests.length, `${block.name} names no TS test`).toBeGreaterThan(0);
      for (const t of block.tests) {
        expect(fs.existsSync(path.join(ROOT, t.spec)), `${block.name}: ${t.spec} is missing`).toBe(true);
        expect(testNames(t.spec), `${block.name}: ${t.spec} has no test ${t.method}`).toContain(t.method);
      }
    }
  });
}

test('Employee and Leaves (TS) keeps the Java suite blocks, in order', () => {
  expect(suite('employeeAndLeaves-ts.xml').blocks.map((b) => b.name)).toEqual([
    'Log in programmatically',
    'Case 181 - Verify that admin can add a new employee with all required fields',
    'Case 183 - Verify that first name with numbers is rejected',
    'Case 182 - Verify that Save stays disabled while a required field is empty',
    'Case 340 - Verify that the admin can add a new employee from Registration Requests',
    'Clean up - Delete the employee record (after test 1)',
    'Case 185 - Verify that job number longer than 20 characters is rejected',
    'Clean up programmatically',
  ]);
});

test('Employee and Leaves (TS) blocks keep their parameters', () => {
  const blocks = suite('employeeAndLeaves-ts.xml').blocks;
  expect(blocks[1].params.employee_job_number).toBe('SK{run}');
  expect(blocks[1].params.employee_department).toBe('test');
  expect(blocks[3].params.employee_job_number_empty).toBe('');
  expect(blocks[5].params.recordKey).toBe('added_employee_users');
  expect(blocks[6].params.employee_job_number).toBe('SK123456789012345678X{run:185}');
});

test('Emloyess 2 (TS) has the Java cases 340, 341, 342 and keeps its clean-up last', () => {
  expect(suite('emloyess2-ts.xml').blocks.map((b) => b.name)).toEqual([
    'Log in programmatically',
    'Case 340 - Verify that the admin can add a new employee from Registration Requests',
    "Case 341 - Verify that the admin can edit the new employee's data",
    'Case 342 - Verify that the admin can delete the employee',
    'Clean-up programmatically',
  ]);
});

test('Invoices (TS) keeps the Java suite blocks and parameters', () => {
  const blocks = suite('invoices-ts.xml').blocks;
  expect(blocks.map((b) => b.name)).toEqual(['Log in programmatically', 'Admin creates an invoice', 'Clean up programmatically']);
  expect(blocks[1].params.invoice_quantity).toBe('2');
  expect(blocks[1].params.invoice_unit_price).toBe('75');
});

test('Overtime Management (TS) keeps the Java suite blocks, in order, and the suite parameters', () => {
  const plan = suite('overtimeManagement-ts.xml');
  expect(plan.blocks.map((b) => b.name)).toEqual([
    'Log in programmatically',
    'Set up - an employee with a pending overtime request',
    'Set up - overtime request rejected',
    'Case 231 - Verify that the monthly balance field shows when overtime is on',
    'Case 234 - Verify the details of a pending overtime request',
    'Case 237 - Verify that a rejected request shows who rejected it and why',
    'Set up - pending overtime request for Verify that rejecting with a reason rejects the request',
    'Case 236 - Verify that rejecting with a reason rejects the request',
    'Set up - pending overtime request for Verify that approving a pending request approves it',
    'Case 238 - Verify that approving a pending request approves it',
    'Case 232 - Verify that a negative monthly balance is refused',
    'Case 233 - Verify that a minimum daily overtime above the maximum is refused',
    'Case 235 - Verify that rejecting without a reason is blocked',
    'Clean up programmatically',
  ]);
  expect(plan.params.reject_reason).toBe('Not needed');
  expect(plan.blocks[9].params.approve_reason).toBe('Approved for overtime');
});

test('Overtime Management traps (TS) keeps the Java suite blocks, in order', () => {
  expect(suite('overtimeManagementTraps-ts.xml').blocks.map((b) => b.name)).toEqual([
    'Log in programmatically',
    'Set up - pending overtime request',
    'Set up - overtime request rejected',
    'Case 242 - Verify that a pending overtime request shows the status Approved in its details',
    'Case 245 - Verify that a rejected request shows no rejection reason',
    'Case 239 - Verify that the monthly balance field is hidden when overtime is on',
    'Case 241 - Verify that a minimum daily overtime above the maximum is saved',
    'Set up - pending overtime request for Verify that rejecting with a reason approves the request',
    'Case 244 - Verify that rejecting with a reason approves the request',
    'Set up - pending overtime request for Verify that approving a pending request rejects it',
    'Case 246 - Verify that approving a pending request rejects it',
    'Case 240 - Verify that a negative monthly balance is saved',
    'Case 243 - Verify that rejecting without a reason rejects the request',
    'Clean up programmatically',
  ]);
});

test('Plans (TS) keeps the Java suite blocks, in order, and the suite parameters', () => {
  const plan = suite('plans-ts.xml');
  expect(plan.blocks.map((b) => b.name)).toEqual([
    'Log in programmatically',
    'Case 290 - Verify that G1 Verify that adding a new plan saves it',
    'Clean up - Delete the plan record (after test 1)',
    "Case 291 - Verify that G2 Verify that editing a plan's days off saves it",
    'Clean up - Delete the record (after test 2)',
    'Case 292 - Verify that G3 Verify that adding a regular shift saves its times',
    'Clean up - Delete the regular shift record (after test 3)',
    'Case 297 - Verify that G8 Verify that removing the employee from a shift saves it',
    'Clean up - Delete the record (after test 4)',
    'Case 298 - Verify that G9 Verify that a shift with no employees is deleted',
    'Clean up - Delete the record (after test 5)',
    'Case 299 - Verify that G10 Verify that a plan with no shifts is deleted',
    'Clean up - Delete the record (after test 6)',
    "Case 294 - Verify that G5 Verify that the plan filter shows only that plan's shifts",
    'Case 293 - Verify that G4 Verify that a new shift starts tomorrow by default',
    'Case 295 - Verify that G6 Verify that a plan with shifts cannot be deleted',
    'Case 296 - Verify that G7 Verify that a shift with an employee cannot be deleted',
    'Clean up - Delete the records of tests 7 to 10',
  ]);
  expect(plan.params.shift_start_time).toBe('10:00 am');
  expect(plan.blocks[1].params.shift_plan_name).toBe('Trova Plan {run:290}');
});
