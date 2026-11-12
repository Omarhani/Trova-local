import { expect, test } from '@playwright/test';
import { SecretValues } from '../../src/report/secretValues';
import { typedValue } from '../../src/report/typedValue';

/**
 * Omar, TS phone run 633: "Type Job number" showed no value. Every Type / Select step carries the value it typed or
 * chose; a password, confirm-password, token, code, OTP, PIN or secret field shows "***" with a reference id, never
 * the value (decided by the field's name or its password box).
 */

test('a typed value is shown as typed', () => {
  const secrets = new SecretValues(() => undefined);
  expect(typedValue('Job number', '//*[@id="job"]', 'E-1042', false, secrets)).toEqual({ v: 'E-1042' });
  expect(typedValue('First name', 'css=#first', 'Ali', false, secrets)).toEqual({ v: 'Ali' });
});

test('a password, confirm password, token, code, OTP, PIN or secret field shows *** with a reference, never the value', () => {
  const secrets = new SecretValues(() => undefined);
  for (const field of ['Password', 'Confirm password', 'New password', 'API token', 'Verification code', 'OTP', 'PIN', 'Client secret', 'كلمة المرور', 'رمز التحقق']) {
    const f = typedValue(field, 'css=#x', 'S3cret!9', false, secrets);
    expect(f.v, field).toBe('***');
    expect(f.secret, field).toBe(true);
    expect(f.ref, field).toMatch(/^[a-z0-9-]{8,}$/);
    expect(JSON.stringify(f), field).not.toContain('S3cret!9');
  }
});

test('a password box found by its locator is masked whatever its name', () => {
  const f = typedValue('Field', "//input[@type='password']", 'S3cret!9', false, new SecretValues(() => undefined));
  expect(f.v).toBe('***');
});

test('the secret goes only to Trova\'s own secret channel, once, by its reference - never in the step', () => {
  const sent: Record<string, unknown>[] = [];
  const secrets = new SecretValues((ref, value) => sent.push({ ref, value }));
  const f = typedValue('Password', 'css=#pw', 'S3cret!9', false, secrets);
  expect(sent).toEqual([{ ref: f.ref, value: 'S3cret!9' }]);
});

test('every secret gets its own reference', () => {
  const secrets = new SecretValues(() => undefined);
  expect(typedValue('Password', 'css=#a', 'one', false, secrets).ref).not.toBe(typedValue('Password', 'css=#b', 'two', false, secrets).ref);
});

test('a value typed into a secret field is hidden from any later text (a check, a message)', () => {
  const secrets = new SecretValues(() => undefined);
  typedValue('New password', 'css=#pw', 'Pa55word!', false, secrets);
  expect(secrets.hide('expected "Pa55word!", seen "Pa55word!"')).toBe('expected "***", seen "***"');
  expect(secrets.hide('Welcome, Ali')).toBe('Welcome, Ali');
});

test('boundary: an empty value shows nothing to mask; a one-letter secret is still masked but never hides single letters', () => {
  const secrets = new SecretValues(() => undefined);
  expect(typedValue('Name', 'css=#n', '', false, secrets)).toEqual({ v: '' });
  expect(typedValue('PIN', 'css=#p', '7', false, secrets).v).toBe('***');
  expect(secrets.hide('Room 7')).toBe('Room 7');
});
