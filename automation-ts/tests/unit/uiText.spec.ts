import { expect, test } from '@playwright/test';
import { withoutClose } from '../../src/web/uiText';

test('a close mark at the end is left out', () => {
  expect(withoutClose('تمت اضافة الموظف بنجاح×')).toBe('تمت اضافة الموظف بنجاح');
  expect(withoutClose('Saved successfully\n✕')).toBe('Saved successfully');
});

test('a close mark inside the text stays', () => {
  expect(withoutClose('2 × 3')).toBe('2 × 3');
});

test('spaces and new lines become one space, ends trimmed', () => {
  expect(withoutClose('  الرقم   الوظيفي\n يجب  ')).toBe('الرقم الوظيفي يجب');
});

test('a trailing " x" close letter is left out, a short text keeps it', () => {
  expect(withoutClose('Saved x')).toBe('Saved');
  expect(withoutClose('x')).toBe('x');
});

test('an empty text stays empty', () => {
  expect(withoutClose('')).toBe('');
});
