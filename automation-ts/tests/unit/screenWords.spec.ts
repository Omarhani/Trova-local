import { expect, test } from '@playwright/test';
import { expectedGreeting } from '../../src/phone/greeting';
import { allOfColour, colourOf, coloursSeen } from '../../src/web/planColour';
import { byUserName, listOf } from '../../src/api/rows';

test('the home greeting is expected in the language the app shows', () => {
  expect(expectedGreeting('أهلا Omar', 'Omar')).toBe('أهلا Omar');
  expect(expectedGreeting('Welcome Omar', 'Omar')).toBe('Welcome Omar');
  expect(expectedGreeting('', 'Omar')).toBe('Welcome Omar');
});

test('a plan\'s colour is read from its style; none = undefined', () => {
  expect(colourOf('display: flex; --event-color: #8e44ad; color: red')).toBe('#8e44ad');
  expect(colourOf('--event-color: rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
  expect(colourOf('color: red')).toBeUndefined();
  expect(colourOf(null)).toBeUndefined();
});

test('the list of an answer is under Data.List; a missing one is empty', () => {
  expect(listOf({ Data: { List: [{ a: 1 }] } })).toEqual([{ a: 1 }]);
  expect(listOf({ Data: null })).toEqual([]);
  expect(listOf(undefined)).toEqual([]);
});

test('a row is found by its user name in any letter case, never by a part of it', () => {
  const rows = [{ UserName: 'o.hany+a@t2.sa', ID: '1' }, { UserName: 'o.hany+ab@t2.sa', ID: '2' }];
  expect(byUserName(rows, 'O.Hany+AB@t2.sa')?.ID).toBe('2');
  expect(byUserName(rows, 'o.hany+@t2.sa')).toBeUndefined();
});

test('the plan filter passes only when every shift shown has the plan\'s colour', () => {
  const plan = '--event-color: #8e44ad;';
  expect(allOfColour([`a; ${plan}`, plan], '#8e44ad')).toBe(true);
  expect(allOfColour([plan, '--event-color: #123456;'], '#8e44ad')).toBe(false);
});

test('a filter that shows no shift at all is not a pass', () => {
  expect(allOfColour([], '#8e44ad')).toBe(false);
});

test('the colours the filtered calendar shows: the plan\'s own, any other by its value, none when empty', () => {
  const plan = '#F39C12';
  expect(coloursSeen([`background: ${plan}`, `--event-color: ${plan};`], plan)).toEqual([plan]);
  expect(coloursSeen([`background: ${plan}`, 'background: #885368;'], plan)).toEqual([plan, '#885368']);
  expect(coloursSeen(['background: rgb(1, 2, 3)'], plan)).toEqual(['rgb(1, 2, 3)']);
  expect(coloursSeen([], plan)).toEqual([]);
});
