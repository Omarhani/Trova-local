import { expect, test } from '@playwright/test';
import { clearCommands, clearCount, FULL, typedRight, wrongField } from '../../src/core/fieldKeys';

/**
 * Omar 2026-11-11 (TS phone suite, case 462): select all + delete took ONE letter off the account-code box
 * ("o.hany" -> "o.han" + the new value). The box is emptied the way Trova's AI-run tools do it (agent-tools
 * trova-phone-shell clearField): from the end, then from the start, a key for every letter it holds and a few more; then
 * the box is read and must hold exactly the typed value.
 */
test('the box is emptied from both ends, one key for every letter it holds and 5 more', () => {
  expect(clearCount({ text: 'o.hany', password: false })).toBe(11);
  const [fromEnd, fromStart] = clearCommands(3);
  expect(fromEnd).toEqual(['input', 'keyevent', 'KEYCODE_MOVE_END', 'KEYCODE_DEL', 'KEYCODE_DEL', 'KEYCODE_DEL']);
  expect(fromStart).toEqual(['input', 'keyevent', 'KEYCODE_MOVE_HOME', 'KEYCODE_FORWARD_DEL', 'KEYCODE_FORWARD_DEL', 'KEYCODE_FORWARD_DEL']);
});

test('a password box or a box not read gets the full 60 keys', () => {
  expect(clearCount({ text: '', password: true })).toBe(FULL);
  expect(clearCount(undefined)).toBe(FULL);
});

test('run 707: a box that shows no text to the phone tools (Flutter keeps "o.hany" hidden) gets the full 60 keys, not 5', () => {
  expect(clearCount({ text: '', password: false })).toBe(FULL);
});

test('boundary: a box longer than 60 letters is still emptied whole', () => {
  expect(clearCount({ text: 'x'.repeat(150), password: false })).toBe(155);
});

test('the typed value is right only when the box holds exactly it', () => {
  expect(typedRight({ text: 'Auto_Overtime', password: false }, 'Auto_Overtime')).toBe(true);
  expect(typedRight({ text: 'o.hanAuto_Overtime', password: false }, 'Auto_Overtime')).toBe(false);
  expect(typedRight({ text: 'old', password: false }, '')).toBe(false);
});

test('a password box, or a box the screen does not show the text of, is not read', () => {
  expect(typedRight({ text: '••••', password: true }, 'secret')).toBe(true);
  expect(typedRight({ text: '', password: false }, 'abc')).toBe(true);
  expect(typedRight(undefined, 'abc')).toBe(true);
});

test('a wrong box reads Expected / Actual; a secret box never shows its values', () => {
  expect(wrongField('Search', 'abc', 'xabc', false)).toBe('Expected: Search shows "abc" / Actual: it shows "xabc"');
  const secret = wrongField('Account code', 'o.hany', 'o.hanyo.hany', true);
  expect(secret).toBe('Expected: Account code holds the typed value / Actual: it holds a different value');
  expect(secret).not.toContain('o.hany');
});
