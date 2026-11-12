import { expect, test } from '@playwright/test';
import { firstTaker } from '../../src/data/overtimeTaker';

const took = async () => ({ ok: true, message: '' });
const refused = (why: string) => async () => ({ ok: false, message: why });

test('the first employee the app takes it from is used, the others are not tried', async () => {
  const tried: string[] = [];
  const r = await firstTaker(['Employee over Time', 'Employee over Time 2'], async (l) => { tried.push(l); return took(); });
  expect(r).toEqual({ login: 'Employee over Time', said: [] });
  expect(tried).toEqual(['Employee over Time']);
});

test('the second employee when the first already has today\'s request, with the first refusal in the app\'s words', async () => {
  const r = await firstTaker(['Employee over Time', 'Employee over Time 2'],
    async (l) => (l === 'Employee over Time' ? refused('لديك طلب عمل إضافي لهذا اليوم')() : took()));
  expect(r).toEqual({ login: 'Employee over Time 2', said: ['Employee over Time: لديك طلب عمل إضافي لهذا اليوم'] });
});

test('nobody takes it: every login with its own refusal, a sign-in refusal included', async () => {
  const r = await firstTaker(['A', 'B'], async (l) => {
    if (l === 'A') throw new Error('HTTP 400 at the account code');
    return refused('')();
  });
  expect(r.login).toBeUndefined();
  expect(r.said).toEqual(['A: could not sign in on the phone (HTTP 400 at the account code)', 'B: refused without a reason']);
});

test('an empty login is left out', async () => {
  const tried: string[] = [];
  await firstTaker(['', 'B'], async (l) => { tried.push(l); return took(); });
  expect(tried).toEqual(['B']);
});
