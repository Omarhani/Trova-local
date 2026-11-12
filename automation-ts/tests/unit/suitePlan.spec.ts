import { expect, test } from '@playwright/test';
import { isTsSuite, parseSuite } from '../../src/run/suitePlan';

const xml = `<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="Emloyess 2 (TS)">
  <parameter name="browser" value="headlessChrome"/>
  <test name="Log in programmatically">
    <parameter name="signedInAs" value="Admin"/>
    <classes><class name="ts:tests/api/employeeAndLeaves/employeeAndLeaves.spec.ts">
      <methods><include name="logInProgrammatically"/></methods></class></classes>
  </test>
  <test name="Case 340 - Verify that the admin can add a new employee &amp; more">
    <parameter name="signedInAs" value="Admin"/>
    <parameter name="employee_user_name" value="omar.tc01+{run:340}@t2saas.sa"/>
    <groups><run><include name="Web"/></run></groups>
    <classes><class name="ts:tests/web/emloyess2/emloyess2.spec.ts">
      <methods><include name="testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests"/></methods></class></classes>
  </test>
</suite>`;

test('the suite name and every <test> block come out in order', () => {
  const plan = parseSuite(xml);
  expect(plan.name).toBe('Emloyess 2 (TS)');
  expect(plan.blocks.map((b) => b.name)).toEqual(['Log in programmatically', 'Case 340 - Verify that the admin can add a new employee & more']);
});

test('a block takes the suite parameters and its own win', () => {
  const block = parseSuite(xml).blocks[1];
  expect(block.params.browser).toBe('headlessChrome');
  expect(block.params.signedInAs).toBe('Admin');
  expect(block.params.employee_user_name).toBe('omar.tc01+{run:340}@t2saas.sa');
});

test('a block keeps its groups and its spec + test names', () => {
  const block = parseSuite(xml).blocks[1];
  expect(block.groups).toEqual(['Web']);
  expect(block.tests).toEqual([{ spec: 'tests/web/emloyess2/emloyess2.spec.ts', method: 'testVerifyThatTheAdminCanAddANewEmployeeFromRegistrationRequests' }]);
});

test('a class with no methods list runs every test of the spec', () => {
  const plan = parseSuite('<suite name="s"><test name="b"><classes><class name="ts:tests/a.spec.ts"/></classes></test></suite>');
  expect(plan.blocks[0].tests).toEqual([{ spec: 'tests/a.spec.ts', method: '' }]);
});

test('a Java class is not a TS test and is left out', () => {
  const plan = parseSuite('<suite name="s"><test name="b"><classes><class name="tests.web.X"/></classes></test></suite>');
  expect(plan.blocks[0].tests).toEqual([]);
});

test('isTsSuite is true only when a class names a ts: spec', () => {
  expect(isTsSuite(xml)).toBe(true);
  expect(isTsSuite('<suite name="s"><test name="b"><classes><class name="tests.web.X"/></classes></test></suite>')).toBe(false);
});
