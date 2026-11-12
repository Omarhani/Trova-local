import { expect, test } from '@playwright/test';
import { autoValue, invoiceNumberOf, moneyTotal } from '../../src/data/invoiceValues';

test('"auto" becomes the given start and the run stamp, any case', () => {
  expect(autoValue('auto', 'AUTO-INV item', 'ab12cd')).toBe('AUTO-INV item ab12cd');
  expect(autoValue('AUTO', 'AUTO-INV', 'ab12cd')).toBe('AUTO-INV ab12cd');
});

test('"{stamp}" is filled, any other value stays as it is', () => {
  expect(autoValue('Item {stamp}', 'x', 'ab12cd')).toBe('Item ab12cd');
  expect(autoValue('WALK-IN', 'x', 'ab12cd')).toBe('WALK-IN');
});

test('the total is quantity times unit price with two decimals and thousands commas', () => {
  expect(moneyTotal('2', '75')).toBe('150.00');
  expect(moneyTotal('3', '0.1')).toBe('0.30');
  expect(moneyTotal('20', '75.5')).toBe('1,510.00');
});

test('the invoice number is read from the created message', () => {
  expect(invoiceNumberOf('رقم 2026056 بمبلغ 150.00 EGP')).toBe('2026056');
});

test('a message without a number gives no number', () => {
  expect(invoiceNumberOf('تم الحفظ')).toBe('');
  expect(invoiceNumberOf('')).toBe('');
});
