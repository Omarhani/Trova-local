import { expect, test } from '@playwright/test';
import { at, fill, loginField, present, transform } from '../../src/trova/recipeValues';

const fields = { 'Account code': 'ACME', Username: 'admin@x.sa', Password: 'Ab1' };
const field = (names: string): string => {
  const v = loginField(fields, names);
  if (v === undefined) throw new Error(`no ${names}`);
  return v;
};

test('a whole-string login placeholder is filled with the login field', () => {
  expect(fill({ Data: { code: '{{login:account code|Account}}' } }, field, {}, {})).toEqual({ Data: { code: 'ACME' } });
});

test('a keep placeholder keeps the JSON shape of the kept value', () => {
  expect(fill('{{keep:account}}', field, { account: { ID: 7 } }, {})).toEqual({ ID: 7 });
});

test('a keep placeholder with a path reads inside the kept value', () => {
  expect(fill('id={{keep:account.ID}}', field, { account: { ID: 7 } }, {})).toBe('id=7');
});

test('a missing kept value fills as empty text, never undefined', () => {
  expect(fill('{{keep:phone}}', field, {}, {})).toBe('');
});

test('a missing login field stops with the field name', () => {
  expect(() => fill('{{login:OTP}}', field, {}, {})).toThrow('no OTP');
});

test('char-offsets shifts each character and the rest by "rest"', () => {
  expect(transform('AAAA', { kind: 'char-offsets', offsets: [1, 2], rest: 3 })).toBe('BCDD');
});

test('the Availo password shift matches the Java one (key Av@il0, +107)', () => {
  const t = { kind: 'char-offsets', offsets: [42, -11, 43, 2, -1, 59], rest: 42 };
  expect(transform('Ab1', t)).toBe(String.fromCharCode(65 + 42, 98 - 11, 49 + 43));
});

test('a login placeholder with a transform uses it', () => {
  const out = fill('{{login:Password>pw}}', field, {}, { pw: { kind: 'char-offsets', offsets: [], rest: 1 } });
  expect(out).toBe('Bc2');
});

test('at reads a dotted path and gives undefined when a part is missing', () => {
  expect(at({ Data: { ID: 3 } }, 'Data.ID')).toBe(3);
  expect(at({ Data: 1 }, 'Data.ID')).toBeUndefined();
});

test('present is false for empty text, null and undefined', () => {
  expect(present('')).toBe(false);
  expect(present(null)).toBe(false);
  expect(present(undefined)).toBe(false);
  expect(present('x')).toBe(true);
});

test('a new:id placeholder gives a fresh id each time', () => {
  const a = fill('{{new:id}}', field, {}, {});
  const b = fill('{{new:id}}', field, {}, {});
  expect(a).not.toBe(b);
});
