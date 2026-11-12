import { expect, test } from '@playwright/test';
import { apiStep } from '../../src/report/apiStep';
import { RecordNames } from '../../src/report/recordNames';
import { SecretValues } from '../../src/report/secretValues';

/**
 * Omar, run 633: an API step says what it did and the main values it sent - a secret as ***. Test 8094 run 642: it
 * names the record in plain words (Delete user "Ali Test" (by API)) and never shows an id.
 */

const none = () => new SecretValues(() => undefined);
const noNames = () => new RecordNames();
const ID = '18e2d105-9613-4c1e-9a55-0d1f2b3c4d5e';

test('an API step names the record it made in plain words, then the main values it sent, and says it was by API', () => {
  const body = JSON.stringify({ Data: { FirstName: 'Ali', LastName: 'Test', JobNumber: 'xyz', Email: 'ali@t.sa' }, Language: 0 });
  const s = apiStep('POST', 'https://api.app/api/User/AddUser', body, none(), noNames());
  expect(s).toEqual({ a: 'api', e: 'Add user "Ali Test" - Job number "xyz", Email "ali@t.sa" (by API)' });
});

test('a secret it sent shows *** and is hidden from later text', () => {
  const secrets = none();
  const body = JSON.stringify({ UserName: 'ali', Password: 'Pa55word!', ConfirmPassword: 'Pa55word!', Token: 'abc.def.ghi' });
  const s = apiStep('POST', 'https://api.app/api/Account/Register', body, secrets, noNames());
  expect(s?.e).toBe('Register account - User name "ali", Password "***", Confirm password "***", Token "***" (by API)');
  expect(JSON.stringify(s)).not.toContain('Pa55word!');
  expect(secrets.hide('Pa55word!')).toBe('***');
});

test('a read (get, search, list) is not a step - it stays in Network only', () => {
  expect(apiStep('GET', 'https://api.app/api/User/1', undefined, none(), noNames())).toBeNull();
  expect(apiStep('POST', 'https://api.app/api/User/GetAllUsers', '{"Data":{"PageSize":10}}', none(), noNames())).toBeNull();
  expect(apiStep('POST', 'https://api.app/api/Leave/SearchLeaves', '{}', none(), noNames())).toBeNull();
});

// Test 8094 run 642: 'Call Delete user - User id "18e2d105-…"' - the id is never shown; the record is named instead
test('a delete names the record it removed by the name the run read before, never its id', () => {
  const names = noNames();
  names.learn(undefined, JSON.stringify({ Data: { List: [{ UserId: ID, FirstName: 'Ali', LastName: 'Test' }] } }));
  const s = apiStep('POST', 'https://api.app/api/User/Delete', JSON.stringify({ Data: { UserId: ID } }), none(), names);
  expect(s).toEqual({ a: 'api', e: 'Delete user "Ali Test" (by API)' });
});

test('a delete of a record the run never read says what it did, with no id', () => {
  const s = apiStep('POST', 'https://api.app/api/User/Delete', JSON.stringify({ Data: { UserId: ID } }), none(), noNames());
  expect(s).toEqual({ a: 'api', e: 'Delete user (by API)' });
  expect(apiStep('DELETE', 'https://api.app/api/WorkPlan/Delete?id=7', undefined, none(), noNames())).toEqual({ a: 'api', e: 'Delete work plan (by API)' });
});

test('an id-looking value under any name is left out; the other values stay', () => {
  const body = JSON.stringify({ Ref: ID, ShiftId: 12, Note: 'night' });
  expect(apiStep('POST', 'https://api.app/api/Shift/Update', body, none(), noNames())?.e).toBe('Update shift - Note "night" (by API)');
});

test('boundary: at most 4 values, long values cut, nested objects and lists left out', () => {
  const body = JSON.stringify({ A: '1', B: '2', C: '3', D: '4', E: '5', Note: 'x'.repeat(80), List: [1, 2], Obj: { x: 1 } });
  const s = apiStep('POST', 'https://api.app/api/Thing/Create', body, none(), noNames());
  expect(s?.e).toBe('Create thing - A "1", B "2", C "3", D "4" (by API)');
  const long = apiStep('POST', 'https://api.app/api/Thing/Create', JSON.stringify({ Note: 'x'.repeat(80) }), none(), noNames());
  expect(long?.e).toBe(`Create thing - Note "${'x'.repeat(40)}…" (by API)`);
});
