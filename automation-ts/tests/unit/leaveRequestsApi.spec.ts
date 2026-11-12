import { expect, test } from '@playwright/test';
import { HttpAnswer } from '../../src/api/http';
import { leaveRecords, LeaveRequestsApi, PhoneApi } from '../../src/api/services/leaveRequestsApi';
import { Json } from '../../src/run/runDataFile';

/** a phone API double at the edge: records what was sent, answers from a script */
function fake(answers: Record<string, unknown[]>): PhoneApi & { sent: { endpoint: string; body?: Json }[] } {
  const sent: { endpoint: string; body?: Json }[] = [];
  const next = (endpoint: string): HttpAnswer => {
    const a = (answers[endpoint] ?? []).shift();
    return { status: 200, text: JSON.stringify(a ?? { Data: null, Status: true }) };
  };
  return {
    sent,
    value: (key: string) => ({ USER_ID: 'u-1', ACCOUNT_ID: 'a-1' } as Record<string, string>)[key],
    get: async (endpoint: string) => { sent.push({ endpoint }); return next(endpoint); },
    post: async (endpoint: string, body: Json) => { sent.push({ endpoint, body }); return next(endpoint); },
  };
}

const ROW = { ID: 164872, StatusId: 2, TypeID: 3, FromDate: '2026-12-01T00:00:00', ToDate: '2026-12-01T00:00:00', Notes: 'Trova leave ab12cd' };

test('the list is the app\'s own call: the employee\'s id as the data, in the app\'s envelope', async () => {
  const api = fake({ 'Leaves/AllLeaves': [{ Data: [ROW], Status: true }] });
  const rows = await new LeaveRequestsApi(api).list();
  expect(rows).toEqual([ROW]);
  const body = api.sent[0].body as Record<string, unknown>;
  expect(api.sent[0].endpoint).toBe('Leaves/AllLeaves');
  expect(body.UserID).toBe('u-1');
  expect(body.Data).toBe('u-1');
});

test('the delete sends the request id as the app does (text) with the employee id', async () => {
  const api = fake({});
  await new LeaveRequestsApi(api).delete(164872);
  expect(api.sent[0]).toMatchObject({ endpoint: 'Leaves/Delete', body: { UserID: 'u-1', Data: { userID: 'u-1', LeaveID: '164872' } } });
});

test('trap: a delete the app refuses fails with the app\'s own words', async () => {
  const api = fake({ 'Leaves/Delete': [{ Data: false, Status: false, Message: 'Cannot delete a decided request' }] });
  await expect(new LeaveRequestsApi(api).delete(1)).rejects.toThrow('Cannot delete a decided request');
});

test('trap: a list the app refuses is an error, never an empty list', async () => {
  const api = fake({ 'Leaves/AllLeaves': [{ Data: null, Status: false, Message: 'Unauthorized' }] });
  await expect(new LeaveRequestsApi(api).list()).rejects.toThrow('Unauthorized');
});

test('the leave types come from the app\'s GET Leaves/LeaveTypes', async () => {
  const api = fake({ 'Leaves/LeaveTypes': [{ Data: [{ ID: 2, NameEn: 'Leave', SubTypes: [] }], Status: true }] });
  expect(await new LeaveRequestsApi(api).kinds()).toEqual([{ ID: 2, NameEn: 'Leave', SubTypes: [] }]);
});

test('clean-up finds this run\'s request by its note only, deletes it and sees it gone', async () => {
  const other = { ...ROW, ID: 1, Notes: 'someone else' };
  const api = fake({ 'Leaves/AllLeaves': [{ Data: [other, ROW], Status: true }, { Data: [other], Status: true }] });
  const records = leaveRecords(new LeaveRequestsApi(api));
  expect(await records.idOf('Trova leave ab12cd')).toBe(164872);
  await records.delete('164872');
  expect(await records.idOf('Trova leave ab12cd')).toBeUndefined();
  expect(api.sent.filter((s) => s.endpoint === 'Leaves/Delete')).toHaveLength(1);
});

test('boundary: a blank note never matches a request with no note', async () => {
  const api = fake({ 'Leaves/AllLeaves': [{ Data: [{ ...ROW, Notes: '' }], Status: true }] });
  expect(await leaveRecords(new LeaveRequestsApi(api)).idOf('')).toBeUndefined();
});

/** Test 8094 run 634: GET Leaves/LeaveTypes answers a BARE list (no Data / Status wrapper) - read as it is */
test('the leave types answer as a bare list is read as the list', async () => {
  const api = fake({ 'Leaves/LeaveTypes': [[{ ID: 2, NameEn: 'Leave', SubTypes: [{ ID: 3, NameEn: 'Sick leave' }] }]] });
  expect(await new LeaveRequestsApi(api).kinds()).toEqual([{ ID: 2, NameEn: 'Leave', SubTypes: [{ ID: 3, NameEn: 'Sick leave' }] }]);
});

test('send: the whole-day request of the type, day and note goes in the app\'s envelope as the employee', async () => {
  const api = fake({});
  const kind = { categoryId: 2, typeId: 3, nameEn: 'Sick leave', nameAr: '' };
  const said = await new LeaveRequestsApi(api).send({ kind, day: new Date(2026, 11, 1), today: new Date(2026, 10, 11), note: 'Trova leave r1' });
  expect(said.ok).toBe(true);
  expect(api.sent[0]).toMatchObject({ endpoint: 'Leaves/Create', body: { UserID: 'u-1', Data: { userID: 'u-1', AccountID: 'a-1',
    fromDate: '2026-12-01', toDate: '2026-12-01', fromTime: '', toTime: '', typeID: 3, notes: 'Trova leave r1' } } });
});

test('trap: a request the app refuses is not ok, with the app\'s own words', async () => {
  const api = fake({ 'Leaves/Create': [{ Status: false, Message: 'يوجد طلب في نفس اليوم' }] });
  const kind = { categoryId: 2, typeId: 3, nameEn: 'Sick leave', nameAr: '' };
  const said = await new LeaveRequestsApi(api).send({ kind, day: new Date(2026, 11, 1), today: new Date(2026, 10, 11), note: 'n' });
  expect(said).toEqual({ ok: false, status: 200, message: 'يوجد طلب في نفس اليوم' }); // status: the set-up's failed line shows it
});
