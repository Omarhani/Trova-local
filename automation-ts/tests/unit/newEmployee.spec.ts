import { expect, test } from '@playwright/test';
import { fullName, lettersOf, newEmployee, nextPassword, userNameFor } from '../../src/data/newEmployee';

test('the run stamp becomes letters only: digit 0-9 is A-J, a letter stays', () => {
  expect(lettersOf('3a09ff')).toBe('DaAJff');
  expect(lettersOf('0123456789')).toBe('ABCDEFGHIJ');
});

test('a new employee: first name given, last name = tag + stamp in letters, job number upper case', () => {
  const e = newEmployee({ tag: 'apiCycle', stamp: '1b2c3d', userName: 'O.Hany+ApiCycle1b2c3d@t2.sa', firstName: 'Omar' });
  expect(e.firstName).toBe('Omar');
  expect(e.lastName).toBe('ApiCycleBbCcDd');
  expect(e.jobNumber).toBe('APICYCLE1B2C3D');
  expect(e.userName).toBe('o.hany+apicycle1b2c3d@t2.sa');
  expect(fullName(e)).toBe('Omar ApiCycleBbCcDd');
});

test('names keep letters only, whatever the tag holds', () => {
  const e = newEmployee({ tag: 'mob-Create 2', stamp: 'ab12cd', userName: 'x@y.z', firstName: 'Omar' });
  expect(e.lastName).toMatch(/^[A-Za-z]+$/);
  expect(e.lastName.startsWith('MobCreate')).toBe(true);
});

test('a long tag is cut so the job number stays at most 20 characters', () => {
  const e = newEmployee({ tag: 'averyveryverylongscenarioname', stamp: 'abcdef', userName: 'x@y.z', firstName: 'Omar' });
  expect(e.jobNumber.length).toBeLessThanOrEqual(20);
  expect(e.jobNumber.endsWith('ABCDEF')).toBe(true);
});

test('a tag with under 2 letters falls back to "Api" as Java does', () => {
  expect(newEmployee({ tag: '1', stamp: 'aaaaaa', userName: 'x@y.z', firstName: 'Omar' }).jobNumber).toBe('APIAAAAAA');
});

test('the next password differs from the old one, keeps it whole and stays at most 40 characters', () => {
  expect(nextPassword('Abc@12345')).not.toBe('Abc@12345');
  expect(nextPassword('Abc@12345').startsWith('Abc@12345')).toBe(true);
  expect(nextPassword('x'.repeat(40)).length).toBe(40);
  expect(nextPassword('x'.repeat(40))).not.toBe('x'.repeat(40));
});

test('the user name of a new employee is the admin e-mail with +tag and stamp, in lower case', () => {
  expect(userNameFor('O.Hany@t2.sa', 'apiCycle', '1b2c3d')).toBe('o.hany+apicycle1b2c3d@t2.sa');
});

test('a login without an e-mail cannot name the new employee - plain words, no guess', () => {
  expect(() => userNameFor('ohany', 'x', 'aaaaaa')).toThrow(/user name/);
});
