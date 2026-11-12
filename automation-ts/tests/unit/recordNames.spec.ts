import { expect, test } from '@playwright/test';
import { RecordNames } from '../../src/report/recordNames';

/** Test 8094 run 642: an API step names its record by what the run created or read - never by its id. */

test('a record read in a list answer is known by its plain name', () => {
  const names = new RecordNames();
  names.learn(undefined, JSON.stringify({ Data: { List: [
    { UserId: 'u-1', FirstName: 'Ali', LastName: 'Test', UserName: 'ali.test' },
    { Id: 7, Name: 'Morning plan' },
  ] } }));
  expect(names.nameOf('u-1')).toBe('Ali Test');
  expect(names.nameOf('7')).toBe('Morning plan');
});

test('a record the run made is known by the name it sent, with the id the app gave back', () => {
  const names = new RecordNames();
  names.learn(JSON.stringify({ Data: { Name: 'Night plan', Days: 5 } }), JSON.stringify({ Data: 42, Result: true }), true);
  names.learn(JSON.stringify({ FirstName: 'Sara', LastName: 'Ali' }), JSON.stringify({ Data: { Id: 'e-9' } }), true);
  names.learn(JSON.stringify({ Data: { Name: 'Day plan' } }), JSON.stringify({ Data: 1 }));
  expect(names.nameOf('42')).toBe('Night plan');
  expect(names.nameOf('e-9')).toBe('Sara Ali');
  expect(names.nameOf('1')).toBeUndefined(); // an update's answer is no new record
});

test('negative: an id with no name, an unknown id, or a text that is not JSON gives no name', () => {
  const names = new RecordNames();
  names.learn('not json', '<html>');
  names.learn(undefined, JSON.stringify({ Data: { List: [{ Id: 3 }] } }));
  expect(names.nameOf('3')).toBeUndefined();
  expect(names.nameOf('nope')).toBeUndefined();
  expect(names.nameOf('')).toBeUndefined();
});

test('boundary: a user name alone names a row; an Arabic name is kept as it is', () => {
  const names = new RecordNames();
  names.learn(undefined, JSON.stringify([{ UserId: 'u-2', UserName: 'omar.h' }, { Id: 'p-1', NameAr: 'خطة الصباح' }]));
  expect(names.nameOf('u-2')).toBe('omar.h');
  expect(names.nameOf('p-1')).toBe('خطة الصباح');
});
