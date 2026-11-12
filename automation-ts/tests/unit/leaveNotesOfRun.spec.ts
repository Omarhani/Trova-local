import { expect, test } from '@playwright/test';
import { leaveNoteKey, notesByEmployee } from '../../src/data/leaveNotesOfRun';

/** the leave requests a run sent, kept as "<employee user name>|<note>" so the clean-up finds them per employee */
test('a sent request is kept under its employee and its note', () => {
  expect(leaveNoteKey('o+mobleave1@t2.sa', 'Trova leave 1')).toBe('o+mobleave1@t2.sa|Trova leave 1');
});

test('the clean-up groups the notes by employee, in the order kept', () => {
  const keys = ['a@t2.sa|n1', 'b@t2.sa|n2', 'a@t2.sa|n3'];
  expect([...notesByEmployee(keys)]).toEqual([['a@t2.sa', ['n1', 'n3']], ['b@t2.sa', ['n2']]]);
});

test('a note with a "|" in it stays whole', () => {
  expect([...notesByEmployee(['a@t2.sa|leave | day'])]).toEqual([['a@t2.sa', ['leave | day']]]);
});

test('nothing kept: nothing to clean up', () => {
  expect(notesByEmployee([]).size).toBe(0);
});

test('a key with no employee part is never cleaned up as someone else', () => {
  expect(notesByEmployee(['no-bar-here']).size).toBe(0);
});
