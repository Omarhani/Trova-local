import { expect, test } from '@playwright/test';
import { AppApi } from '../../src/api/appApi';
import { HttpAnswer, HttpRequest } from '../../src/api/http';
import { PhoneGuestApi } from '../../src/api/phoneGuestApi';
import { AdminLeavesApi } from '../../src/api/services/adminLeavesApi';
import { EmployeeLocationsApi } from '../../src/api/services/employeeLocationsApi';
import { EmployeeLogInApi } from '../../src/api/services/employeeLogInApi';
import { clockOf, movementsOf, TransactionsApi } from '../../src/api/services/transactionsApi';

type Sent = { call: string; body: unknown };

/** the admin's API at the edge: records each call, answers from a script by call name */
function admin(answers: Record<string, unknown[]>): { api: AppApi; sent: Sent[] } {
  const sent: Sent[] = [];
  const answer = (call: string): HttpAnswer => ({ status: 200, text: JSON.stringify((answers[call] ?? []).shift() ?? { Data: null, Status: true }) });
  const api = {
    underRoot: (_root: string, call: string) => call,
    post: async (call: string, body: unknown) => { sent.push({ call, body }); return answer(call); },
    get: async (call: string) => { sent.push({ call, body: undefined }); return answer(call); },
  } as unknown as AppApi;
  return { api, sent };
}

/** the admin's account id, given (no call) */
function account(): Promise<string> {
  return Promise.resolve('acc-1');
}

test('the movements are the server\'s rows oldest first, check ins and outs by type, time on the account\'s clock', () => {
  const rows = [{ TransactionTypeID: 2, CreateDate: '2026-11-11T18:00:00' }, { TransactionTypeID: 1, CreateDate: '2026-11-11T09:00:00' },
    { TransactionTypeID: 7, CreateDate: '2026-11-11T10:00:00' }];
  expect(movementsOf(rows)).toEqual([{ kind: 'check in', time: '09:00' }, { kind: 'check out', time: '18:00' }]);
  expect(clockOf('2026-11-11 05:31:12')).toBe('05:31');
});

test('a day\'s movements are asked for the employee and the day, read from a bare list too', async () => {
  const { api, sent } = admin({ 'Transaction/GetAllTransactionsByUserId': [{ Data: [{ TransactionTypeID: 1, CreateDate: '2026-11-11T09:00:00' }], Status: true }] });
  expect(await new TransactionsApi(api, account).dayMovements('u-1', '2026-11-11')).toEqual([{ kind: 'check in', time: '09:00' }]);
  expect(sent[0].body).toMatchObject({ data: { Date: '2026-11-11', UserID: 'u-1' } });
});

test('a check out is added on the day\'s check in\'s session, at the first gate of the first department that has one', async () => {
  const { api, sent } = admin({
    'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-0' }, { ID: 'd-1' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [] }, { Data: [{ ID: 'g-1', TimeZoneID: 'tz' }] }],
    'Reports/GetUsersTransactionCorrections': [{ Data: { List: [{ UserId: 'u-1', Transactions: [{ TransactionTypeId: 1, SessionId: 's-9' }] }] } }],
  });
  await new TransactionsApi(api, account).add('u-1', 'check out', '2026-11-11', '18:00');
  expect(sent.at(-1)).toEqual({ call: 'Transaction/CreateAuditTransaction', body: { Data: { transactionType: 2, createDate: '2026-11-11 18:00',
    accessGateId: 'g-1', userId: 'u-1', accountId: 'acc-1', sessionId: 's-9', timezoneID: 'tz' } } });
});

test('trap: a movement the app refuses fails with the app\'s own words', async () => {
  const { api } = admin({
    'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-1' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [{ ID: 'g-1' }] }],
    'Transaction/CreateAuditTransaction': [{ Status: false, Message: 'التوقيت غير صحيح' }],
  });
  await expect(new TransactionsApi(api, account).add('u-1', 'check in', '2026-11-11', '09:00')).rejects.toThrow('التوقيت غير صحيح');
});

test('trap: a check out with no check in that day is a plain set-up stop, never sent', async () => {
  const { api, sent } = admin({ 'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-1' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [{ ID: 'g-1' }] }] });
  await expect(new TransactionsApi(api, account).add('u-1', 'check out', '2026-11-11', '18:00')).rejects.toThrow('has no check in');
  expect(sent.some((s) => s.call === 'Transaction/CreateAuditTransaction')).toBe(false);
});

test('locations: ids by Arabic or English name, the assign body, and the names the tab lists', async () => {
  const { api, sent } = admin({
    'Location/GetAllLocationForDepartment_Users': [{ Data: { List: [{ ID: 'l-1', NameAr: 'المنزل', NameEn: 'Home' }] } }],
    'GateGroup/GetGateGroupsForDepartment_Users': [{ Data: { List: [{ ID: 'g-1', NameAr: 'MainGatesGroup' }] } }],
    'User/GetAllAccessGatesByUserID': [{ Data: { List: [{ NameAr: 'المنزل', NameEn: 'Home' }, { NameAr: 'MainGatesGroup', NameEn: null }] } }],
  });
  const loc = new EmployeeLocationsApi(api);
  const said = await loc.assign('u-1', [await loc.assignableLocationId('u-1', 'Home')], [await loc.assignableGroupId('u-1', 'MainGatesGroup')]);
  expect(said.ok).toBe(true);
  expect(sent[2]).toEqual({ call: 'User/AssigntGatesAndAccessGateToUser', body: { Data: { AccessGateIds: ['l-1'], GateGroupIds: ['g-1'], UserId: 'u-1' } } });
  expect(await loc.assignedNames('u-1')).toEqual(['المنزل', 'Home', 'MainGatesGroup']);
});

test('trap: a location the account does not have stops in plain words', async () => {
  const { api } = admin({ 'Location/GetAllLocationForDepartment_Users': [{ Data: { List: [{ ID: 'l-1', NameEn: 'Office' }] } }] });
  await expect(new EmployeeLocationsApi(api).assignableLocationId('u-1', 'Home')).rejects.toThrow('no location called Home');
});

test('admin leave: added with the type ids of the account\'s own lists, its id found by its note', async () => {
  const { api, sent } = admin({
    'Leaves/GetAllleaveTypeCategoory': [{ Data: [{ ID: 4, NameAr: 'اجازة' }] }],
    'Leaves/GetAllLeavesTypeSubCategory': [{ Data: [{ ID: 7, NameAr: 'سنوية' }] }],
    'Leaves/GetAllLeaves': [{ Data: { List: [{ ID: 99, Notes: 'other' }, { ID: 100, Notes: 'Trova web leave r1' }] } }],
  });
  const leave = { jobNumber: 'J', fullName: 'F', type: 'اجازة', subType: 'سنوية', from: '2026-11-12', to: '2026-11-13', notes: 'Trova web leave r1', userId: 'u-1' };
  expect(await new AdminLeavesApi(api, account).add(leave)).toBe('100');
  expect(sent[2].body).toMatchObject({ data: { AccountID: 'acc-1', UserID: 'u-1', ParentTypeID: 4, TypeID: 7, FromDate: '2026-11-12', ToDate: '2026-11-13' } });
});

test('admin leave: the status as the list words it; a request not listed has none', async () => {
  const { api } = admin({ 'Leaves/GetAllLeaves': [{ Data: { List: [{ ID: 100, StatusId: 4 }] } }, { Data: { List: [] } }] });
  const leaves = new AdminLeavesApi(api, account);
  expect(await leaves.statusOf('100')).toBe('محذوف');
  expect(await leaves.statusOf('100')).toBe('');
});

/** the phone API at the edge for the log-in: answers in order, records each body */
function phone(answers: unknown[]): { guest: PhoneGuestApi; bodies: unknown[] } {
  const bodies: unknown[] = [];
  const send = async (r: HttpRequest): Promise<HttpAnswer> => {
    bodies.push(r.body ? JSON.parse(r.body) : undefined);
    return { status: 200, text: JSON.stringify(answers.shift() ?? { Status: true }) };
  };
  return { guest: new PhoneGuestApi('https://phone.test', send), bodies };
}

test('log-in: asked again while the app still says "under review", then signed in with its token', async () => {
  const { guest } = phone([{ Status: false, Message: 'طلب الموظف تحت المراجعة' }, { Status: true, Data: { AccessToken: 't', ID: 'u-9' } }]);
  const login = await new EmployeeLogInApi(guest, 1).logInWhenApproved('acc', 'a@b.c', 'pw', 5);
  expect(login.ok).toBe(true);
  expect(guest.id()).toBe('u-9');
});

test('trap: a log-in still "under review" when the wait ends fails with the app\'s words', async () => {
  const { guest } = phone(Array.from({ length: 50 }, () => ({ Status: false, Message: 'طلب الموظف تحت المراجعة' })));
  const login = await new EmployeeLogInApi(guest, 1).logInWhenApproved('acc', 'a@b.c', 'pw', 0.05);
  expect(login).toEqual({ ok: false, message: 'the app said "طلب الموظف تحت المراجعة"' });
});

test('trap: a wrong password is not asked again', async () => {
  const { guest, bodies } = phone([{ Status: false, Message: 'كلمة المرور غير صحيحة' }, { Status: true }]);
  expect((await new EmployeeLogInApi(guest, 1).logInWhenApproved('acc', 'a@b.c', 'pw', 5)).ok).toBe(false);
  expect(bodies).toHaveLength(1);
});

test('the phone guest API sends a body already in the app\'s envelope as it is (never two envelopes)', async () => {
  const { guest, bodies } = phone([{ Status: true }, { Status: true }]);
  await guest.post('Leaves/AllLeaves', { UserID: 'u', Data: 'u' });
  await guest.post('User/Login', { UserName: 'a' });
  expect(bodies[0]).toEqual({ UserID: 'u', Data: 'u' });
  expect(bodies[1]).toMatchObject({ Data: { UserName: 'a' }, PageNumber: 1 });
});
