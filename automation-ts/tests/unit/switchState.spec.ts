import { expect, test } from '@playwright/test';
import { switchIsOn } from '../../src/web/switchState';

const off = { ariaChecked: null, ariaPressed: null, tag: 'div', checked: false, inner: null, className: '' };

test('aria-checked decides first', () => {
  expect(switchIsOn({ ...off, ariaChecked: 'true' })).toBe(true);
  expect(switchIsOn({ ...off, ariaChecked: 'false', className: 'mat-checked' })).toBe(false);
});

test('aria-pressed when there is no aria-checked', () => {
  expect(switchIsOn({ ...off, ariaPressed: 'TRUE' })).toBe(true);
  expect(switchIsOn({ ...off, ariaChecked: ' ', ariaPressed: 'false' })).toBe(false);
});

test('a native checkbox reads its checked state', () => {
  expect(switchIsOn({ ...off, tag: 'INPUT', checked: true })).toBe(true);
  expect(switchIsOn({ ...off, tag: 'input', checked: false })).toBe(false);
});

test('an inner input decides for a styled switch', () => {
  expect(switchIsOn({ ...off, inner: true })).toBe(true);
  expect(switchIsOn({ ...off, inner: false, className: 'is-checked' })).toBe(false);
});

test('else an on / checked class word', () => {
  expect(switchIsOn({ ...off, className: 'mat-slide-toggle mat-checked' })).toBe(true);
  expect(switchIsOn({ ...off, className: 'mdc-switch mdc-switch--selected' })).toBe(true);
  expect(switchIsOn({ ...off, className: 'checkedness unchecked' })).toBe(false);
  expect(switchIsOn(off)).toBe(false);
});
