import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { expectedWrongLoginMessage, refusalAnswered, WRONG_ACCOUNT_CODE_MESSAGE, wrongPasswordOf } from '../../src/data/refusedSignIn';
import { SlowAnswer } from '../../src/report/failureKind';

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * The refused sign-in cases (Java MobLoginTests / LoginTests negative cases): a wrong password is the employee's own
 * one changed, so no real account is ever refused; the expected message follows the app's language as Java does.
 */
test('a wrong password is the real one with "-wrong" added - never the real one', () => {
  expect(wrongPasswordOf('Secret1')).toBe('Secret1-wrong');
  expect(wrongPasswordOf('Secret1')).not.toBe('Secret1');
});

test('a wrong password of an empty password is still not empty', () => {
  expect(wrongPasswordOf('')).toBe('-wrong');
});

test('the wrong login message in English when the app shows English', () => {
  expect(expectedWrongLoginMessage('The data entered is incorrect, Please check & Try again'))
    .toBe('The data entered is incorrect, Please check & Try again');
});

test('the wrong login message in Arabic when the app shows Arabic', () => {
  expect(expectedWrongLoginMessage('البيانات المدخلة غير صحيحة'))
    .toBe('البيانات المدخلة غير صحيحة الرجاء التحقق وإعادة المحاولة مرة أخرى');
});

test('no message shown: the English one is expected (the check then shows what was missing)', () => {
  expect(expectedWrongLoginMessage('')).toBe('The data entered is incorrect, Please check & Try again');
  expect(expectedWrongLoginMessage(undefined)).toBe('The data entered is incorrect, Please check & Try again');
});

test('the wrong account code message is the one Java checks', () => {
  expect(WRONG_ACCOUNT_CODE_MESSAGE).toBe('Wrong Account Code or Account not found');
});

test("the refused sign-in cases never use the run's one sign-in (a refusal would block the later sign-in cases)", () => {
  for (const spec of ['tests/mobile/employeeAccount/refusedSignIn.spec.ts', 'tests/web/signIn/refusedSignIn.spec.ts']) {
    const text = fs.readFileSync(path.join(ROOT, spec), 'utf8');
    expect(text, spec).not.toMatch(/signInAs\(|\.signIn\(|openSignedIn\(/);
    expect(text, spec).toMatch(/wrongPasswordOf\(|wrong_account_code/);
  }
});

// run 860: the wrong password case failed "no message" with no proof the app ever answered the sign-in
test('the app never answered the sign-in: not checked (slow), never a failure', () => {
  expect(() => refusalAnswered(undefined, 15)).toThrow(SlowAnswer);
  expect(() => refusalAnswered(undefined, 15)).toThrow("The app did not answer the sign-in within 15 s - not the app's answer");
});

test('the app answered the sign-in: the message check decides, with the answer named', () => {
  expect(refusalAnswered(401, 15)).toBe('the app answered the sign-in with 401');
});
