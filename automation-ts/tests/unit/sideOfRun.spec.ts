import { expect, test } from '@playwright/test';
import { AppApi } from '../../src/api/appApi';
import { HttpAnswer } from '../../src/api/http';
import { TransactionsApi } from '../../src/api/services/transactionsApi';
import { sideOption } from '../../src/web/pages/sideWithGates';

/**
 * Case 529 (suite 72): the drawer opened Side then Gate 6 times (~12 s each) on sides with no gates. The side with
 * gates is found once by API (Java TransactionsApi.firstGate: the side list, then each side's gate list), and the
 * drawer picks it by name.
 */
function admin(answers: Record<string, unknown[]>): { api: AppApi; calls: string[] } {
  const calls: string[] = [];
  const answer = (call: string): HttpAnswer => ({ status: 200, text: JSON.stringify((answers[call] ?? []).shift() ?? { Data: null, Status: true }) } as HttpAnswer);
  const api = {
    underRoot: (_root: string, call: string) => call,
    post: async (call: string) => { calls.push(call); return answer(call); },
  } as unknown as AppApi;
  return { api, calls };
}

const account = () => Promise.resolve('acc-1');

test('the side used is the first of the employee\'s sides that has a gate - its names, a side with none skipped', async () => {
  const { api } = admin({
    'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-0', NameAr: 'بدون بوابات', NameEn: 'No gates' }, { ID: 'd-1', NameAr: 'الإدارة', NameEn: 'Admin side' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [] }, { Data: [{ ID: 'g-1' }] }],
  });
  expect(await new TransactionsApi(api, account).sideWithGates('u-1')).toEqual({ names: ['الإدارة', 'Admin side'] });
});

test('the search stops at the first side with a gate: the later sides are never asked for', async () => {
  const { api, calls } = admin({
    'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-0', Name: 'First' }, { ID: 'd-1', Name: 'Second' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [{ ID: 'g-1' }] }],
  });
  expect(await new TransactionsApi(api, account).sideWithGates('u-1')).toEqual({ names: ['First'] });
  expect(calls.filter((c) => c.startsWith('Location/'))).toHaveLength(1);
});

test('trap: no side with a gate gives none - the case is Not tested, never a look-alike side', async () => {
  const { api } = admin({
    'Department/GetDepartmentsByUserId': [{ Data: [{ ID: 'd-0', NameAr: 'أ' }] }],
    'Location/GetAllActiveLocationByUserDepartmentID': [{ Data: [] }],
  });
  expect(await new TransactionsApi(api, account).sideWithGates('u-1')).toBeUndefined();
});

test('the drawer\'s option for the side matches any of its names exactly', () => {
  expect(sideOption({ names: ['الإدارة', "Admin's side"] })).toBe(
    "//mat-option[normalize-space(.)='الإدارة' or normalize-space(.)=concat('Admin', \"'\", 's side')]");
});
