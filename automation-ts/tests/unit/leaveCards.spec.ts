import { expect, test } from '@playwright/test';
import { allListed, cardsOf, isPending, listLoaded, pendingCountOf, sameEmployee, toastText } from '../../src/phone/screens/leaveCards';

/** My requests on the phone (Test, 2026-11-11, Arabic and English): counters "n\nStatus", cards "id\nStatus\n..." */
const AR = [
  '1\nمقبول', '2\nتحت الإجراء', '1\nمرفوض',
  '164872\nتحت الإجراء\nاجازة-مرضية - يوم واحد\n٠١ ديسمبر ٢٠٢٦ - ٠١ ديسمبر ٢٠٢٦\nتم الإرسال في ١١ نوفمبر ٢٠٢٦',
  '128097\nمرفوض\nاجازة-تعويضية - يوم واحد\n١٥ يونيو ٢٠٢٦ - ١٥ يونيو ٢٠٢٦\nتم الرفض في ١٤ يونيو ٢٠٢٦\nمرفوض من omar one',
];
const EN = ['3\nPending', '128098\nPending\nLeave-Sick leave - 1 Day\n16 Jun 2026 - 16 Jun 2026\nSent on 14 Jun 2026'];

test('the request cards are read with their id and status; the counters are not cards', () => {
  expect(cardsOf(AR).map((c) => [c.id, c.status])).toEqual([['164872', 'تحت الإجراء'], ['128097', 'مرفوض']]);
});

test('pending: the English and the Arabic word', () => {
  const [ar] = cardsOf(AR);
  const [en] = cardsOf(EN);
  expect(isPending(ar)).toBe(true);
  expect(isPending(en)).toBe(true);
  expect(isPending(cardsOf(AR)[1])).toBe(false);
});

test('the Pending counter is read in both languages (number first in Arabic, word first in English)', () => {
  expect(pendingCountOf(AR)).toBe(2);
  expect(pendingCountOf(EN)).toBe(3);
});

test('no Pending counter on the screen: undefined, never 0', () => {
  expect(pendingCountOf(['1\nمقبول'])).toBeUndefined();
});

test('the success message says its text twice: read once', () => {
  expect(toastText('تم إرسال طلبك بنجاح للمسؤول, تم إرسال طلبك بنجاح للمسؤول')).toBe('تم إرسال طلبك بنجاح للمسؤول');
  expect(toastText('Your request has been sent successfully to your manager')).toBe('Your request has been sent successfully to your manager');
});

test('the app is the employee\'s when every card on the screen is in the employee\'s own list', () => {
  expect(allListed(cardsOf(AR), [164872, 128097, 128096])).toBe(true);
  expect(allListed([], [])).toBe(true);
});

test('trap: a card that is not in the employee\'s list means the app is signed in as someone else', () => {
  expect(allListed(cardsOf(AR), [128097])).toBe(false);
});

/** Test 8094 run 640: the counters showed before the cards; the app was another employee's (1 / 1 / 1) */
const RUN_640_EARLY = ['1\nمقبول', '1\nتحت الإجراء', '1\nمرفوض'];

test('trap: counters with requests but no card yet - the list has not loaded', () => {
  expect(listLoaded(RUN_640_EARLY)).toBe(false);
  expect(listLoaded([...RUN_640_EARLY, ...AR.slice(3)])).toBe(true);
});

test('an employee with no requests: counters at 0 are a loaded list', () => {
  expect(listLoaded(['0\nمقبول', '0\nتحت الإجراء', '0\nمرفوض'])).toBe(true);
  expect(listLoaded(['Approved\n0', 'Pending\n0', 'Rejected\n0'])).toBe(true);
});

test('trap (run 640): the app shows 1 / 1 / 1 but the employee has no request - not the employee', () => {
  expect(sameEmployee([...RUN_640_EARLY, ...AR.slice(4)], [])).toBe(false);
});

test('the app is the employee when each counter and every card match the employee\'s own list', () => {
  const rows = [{ ID: 164872, StatusId: 2 }, { ID: 128097, StatusId: 3 }, { ID: 128096, StatusId: 1 }, { ID: 128098, StatusId: 2 }];
  expect(sameEmployee(AR, rows)).toBe(true);
  expect(sameEmployee(AR, rows.slice(0, 3))).toBe(false);
});

/** run 640 again: the app's employee (o.hany main, 0 / 0 / 0) and the suite's (no requests) look the same - never proven */
test('trap: an empty list on both sides proves nothing - the app is not taken as the employee', () => {
  expect(sameEmployee(['0\nمقبول', '0\nتحت الإجراء', '0\nمرفوض'], [])).toBe(false);
});

test('run 781: the new layout writes the word first ("Pending\n2", chips "Approved 0 · Pending 0 · Rejected 0") - read the same', () => {
  expect(pendingCountOf(['Approved\n0', 'Pending\n2', 'Rejected\n0'])).toBe(2);
  expect(pendingCountOf(['مقبول\n0', 'تحت الإجراء\n1'])).toBe(1);
  expect(pendingCountOf(['Pending\nsoon'])).toBeUndefined();
});
