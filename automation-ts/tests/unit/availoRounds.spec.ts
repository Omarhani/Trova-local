import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseSuite } from '../../src/run/suitePlan';

const ROOT = path.resolve(__dirname, '..', '..');
const SUITES = path.join(ROOT, 'suites');

function blocks(file: string) {
  return parseSuite(fs.readFileSync(path.join(SUITES, file), 'utf8')).blocks;
}

/**
 * One suite per scenario, case for case as the Java suite of Availo-Demo/suiteFiles (owner 2026-11-11): a case taken
 * from another Java suite lives in the suite of its own scenario.
 */
const SCENARIOS: Record<string, string[]> = {
  'apiEmployeeCycle-ts.xml': [ // api/apiEmployeeCycle.xml
    'Case - Verify that the employee can sign up from the phone by API',
    'Case - Verify that the request reaches the admin by API',
    'Case - Verify that the admin can approve the request by API',
    'Case - Verify that the employee is listed in employees by API',
    'Case - Verify that the new employee can log in from the phone by API',
    'Case - Verify that the admin can assign locations to the employee by API',
  ],
  'webTimeTables-ts.xml': [ // web/webTimeTables.xml
    'Case - Verify that the admin can add a new work plan',
    'Case - Verify that the admin can edit the work plan',
    'Case - Verify that the admin can add a new regular shift for the employee',
    "Case - Verify that the plan filter shows only that plan's shifts",
    'Case - Verify that a plan with shifts cannot be deleted',
    'Case - Verify that a shift with employees cannot be deleted',
    'Case - Verify that a shift without employees can be deleted',
    'Case - Verify that the admin can delete the work plan',
  ],
  'webCheckInAndOut-ts.xml': [ // web/webCheckInAndOut.xml
    'Case - Verify that the admin can add a check in and a check out for the employee from the web',
    'Case - Verify that the attendance report shows the check in and out added on the web',
  ],
  'webLeaves-ts.xml': [ // web/webLeavesTests.xml
    'Case - Verify that the admin can add a leave for the employee from the web',
    "Case - Verify that the admin can delete the employee's leave from the web",
  ],
  'createEmployeeFromMobile-ts.xml': [ // hybrid/createEmployeeFromMobile.xml
    'Case - Verify that a new employee can register from the app',
    'Case - Verify that the admin can approve the registration request from the web',
    'Case - Verify that the employee view shows the employee',
    'Case - Verify that the approved employee can log in on the app',
  ],
  'hybridCheckInAndOut-ts.xml': [ // hybrid/fullHybridCycleCheckInAndOut.xml
    'Case - Verify that the approved employee can log in on the app',
    'Case - Verify that the employee can check in from the app',
    'Case - Verify that the employee can check out from the app',
    "Case - Verify that the admin can update the app's check in and out from the web",
    'Case - Verify that the attendance report shows the updated check in and out',
  ],
  'mobEmployeeAccount-ts.xml': [ // hybrid/mobLoginAndRegistration.xml
    'Case - Verify that the user cannot log in with a wrong account code on the app',
    'Case - Verify that the app shows a message for a wrong password',
    'Case - Verify that the approved employee can log in on the app',
    'Case - Verify that a new employee can register from the app',
  ],
  'webLoginAndRegistration-ts.xml': [ // web/webLoginAndRegistration.xml (its refused sign-in cases)
    'Case - Verify that the web shows a message for a wrong password',
    'Case - Verify that the web shows a message for a wrong account code',
  ],
  'mobLeaveRequest-ts.xml': [ // mob/mobLeaveRequest.xml
    'Case 462 - Verify that an employee can send a leave request from the phone app',
    'Case - Verify that the Pending request shows its details in the app',
    'Case - Verify that the employee can delete a Pending request in the app',
  ],
  'mobPassword-ts.xml': ['Case - Verify that the employee can change the password and log in with the new one'], // mob/mobPassword.xml
  'mobOpenLoggedIn-ts.xml': ['Case - Verify that the app opens signed in with the kept sign-in'], // mob/mobOpenLoggedIn.xml
  'leaveDecisions-ts.xml': [ // hybrid/mobFullCycleForLeaves.xml (AdminActions)
    'Case - Verify that the admin can accept a leave request sent from the app',
    'Case - Verify that the admin can reject a leave request sent from the app',
    'Case - Verify that the admin can delete a leave request sent from the app',
  ],
};

for (const [file, cases] of Object.entries(SCENARIOS)) {
  test(`${file}: the cases of its Java scenario, in its order`, () => {
    expect(blocks(file).filter((b) => b.name.startsWith('Case')).map((b) => b.name)).toEqual(cases);
  });

  test(`${file}: signs in once before the first case and cleans up by API last`, () => {
    const all = blocks(file);
    expect(all.filter((b) => b.name === 'Log in programmatically').length).toBe(1);
    expect(all.findIndex((b) => b.name === 'Log in programmatically')).toBeLessThan(all.findIndex((b) => b.name.startsWith('Case')));
    expect(all.at(-1)?.name).toBe('Clean up - delete employee by API');
    expect(all.at(-1)?.tests[0].method).toBe('cleanUpEmployeesProgrammatically');
  });

  test(`${file}: hybrid mode - sign-in, set-up and clean-up by the app's API`, () => {
    for (const b of blocks(file)) expect(b.params.mode ?? 'hybrid', b.name).toBe('hybrid');
  });
}

test("a phone case that reuses the run's sign-in keeps the app's data; a sign-in case starts clean", () => {
  const keep = (file: string, name: string) => blocks(file).find((b) => b.name === name)?.params.keepAppData;
  expect(keep('hybridCheckInAndOut-ts.xml', 'Case - Verify that the approved employee can log in on the app')).toBeUndefined();
  expect(keep('hybridCheckInAndOut-ts.xml', 'Case - Verify that the employee can check in from the app')).toBe('true');
  expect(keep('hybridCheckInAndOut-ts.xml', 'Case - Verify that the employee can check out from the app')).toBe('true');
  expect(keep('mobPassword-ts.xml', 'Case - Verify that the employee can change the password and log in with the new one')).toBe('true');
  expect(keep('mobOpenLoggedIn-ts.xml', 'Case - Verify that the app opens signed in with the kept sign-in')).toBe('true');
});

/** Test 8094 run 658: hybrid 64 deleted the employee still signed in on the phone - the next suite met "User has been deleted." */
for (const file of ['mobEmployeeAccount-ts.xml', 'createEmployeeFromMobile-ts.xml', 'hybridCheckInAndOut-ts.xml', 'mobPassword-ts.xml', 'mobOpenLoggedIn-ts.xml', 'mobLeaveRequest-ts.xml']) {
  test(`${file}: the app is signed out on the phone before the clean-up deletes its employee`, () => {
    const all = blocks(file);
    const signOut = all.at(-2);
    expect(signOut?.name).toBe('Clean up - sign the app out');
    expect(signOut?.tests[0].method).toBe('signOutOfTheAppProgrammatically');
    expect(signOut?.params.keepAppData).toBe('true');
    expect(signOut?.groups).toContain('Mob');
  });
}

/** the refused sign-in cases of Java (MobLoginTests, LoginTests): Java's wrong account code, a screen that starts clean */
for (const [file, codeCase] of [
  ['mobEmployeeAccount-ts.xml', 'Case - Verify that the user cannot log in with a wrong account code on the app'],
  ['webLoginAndRegistration-ts.xml', 'Case - Verify that the web shows a message for a wrong account code'],
]) {
  test(`${file}: the wrong account code is Java's, the refused cases start signed out`, () => {
    const refused = blocks(file).filter((b) => /wrong (account code|password)/.test(b.name));
    expect(refused).toHaveLength(2);
    expect(blocks(file).find((b) => b.name === codeCase)?.params.wrong_account_code).toBe('Autooo');
    for (const b of refused) expect(b.params.keepAppData, b.name).toBeUndefined();
  });
}

test('the refused sign-in cases come before the cases that sign in (Java priorities 1, 2, then the valid login)', () => {
  const names = blocks('mobEmployeeAccount-ts.xml').map((b) => b.name);
  const login = names.indexOf('Case - Verify that the approved employee can log in on the app');
  expect(names.indexOf('Case - Verify that the app shows a message for a wrong password')).toBeLessThan(login);
  expect(names.indexOf('Set-up - Create employee by API')).toBeLessThan(names.indexOf('Case - Verify that the app shows a message for a wrong password'));
  const web = blocks('webLoginAndRegistration-ts.xml').map((b) => b.name);
  expect(web.indexOf('Set-up - Create employee by API')).toBeLessThan(web.indexOf('Case - Verify that the web shows a message for a wrong password'));
});

test('API locations: named per environment, never a fixed id', () => {
  const p = blocks('apiEmployeeCycle-ts.xml').find((b) => b.name === 'Case - Verify that the admin can assign locations to the employee by API')?.params;
  expect(p?.location).toMatch(/Test=.+;\s*Stage=.+/);
  expect(p?.location_group).toBeTruthy();
});

test('no new Round file carries the old fia- name', () => {
  for (const file of Object.keys(SCENARIOS)) expect(file.toLowerCase().startsWith('fia')).toBe(false);
});

test('no Round case asserts a fixed count that other people\'s data can change (Omar: never FIXED values)', () => {
  const specs = ['tests/api/employeeCycle/employeeCycle.spec.ts', 'tests/api/employeeCycle/employeeLocations.spec.ts',
    'tests/web/workPlans/workPlans.spec.ts', 'tests/mobile/employeeAccount/employeeAccount.spec.ts',
    'tests/mobile/employeeAccount/employeeAttendance.spec.ts', 'tests/web/employeeRegistration/employeeRegistration.spec.ts',
    'tests/web/attendance/appAttendanceOnWeb.spec.ts', 'tests/web/attendance/webAttendance.spec.ts',
    'tests/web/leaveRequests/adminLeaves.spec.ts', 'tests/web/leaveRequests/leaveDecisions.spec.ts',
    'tests/mobile/leaveRequest/pendingRequest.spec.ts'];
  for (const spec of specs) {
    const text = fs.readFileSync(path.join(ROOT, spec), 'utf8');
    expect(text.match(/check(Equals|True)\([^;]*,\s*\d+\s*\)\s*;/g) ?? [], spec).toEqual([]);
  }
});
