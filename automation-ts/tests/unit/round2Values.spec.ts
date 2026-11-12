import { expect, test } from '@playwright/test';
import { valueForEnv } from '../../src/data/envValue';
import { dmy } from '../../src/data/leaveDay';
import { shownTime } from '../../src/web/shownTime';
import { figuresOf } from '../../src/web/pages/AttendanceReportPage';
import { detailsOf, rightToLeft } from '../../src/phone/screens/leaveDetails';
import { statusWord } from '../../src/api/services/adminLeavesApi';

test('a per-environment value gives the environment\'s own, any letter case', () => {
  expect(valueForEnv('Test=Home; Stage=hany', 'Test')).toBe('Home');
  expect(valueForEnv('Test=Home; Stage=hany', 'stage')).toBe('hany');
});

test('a plain value is the same for every environment', () => {
  expect(valueForEnv(' MainGatesGroup ', 'Stage')).toBe('MainGatesGroup');
});

test('trap: a per-environment value that names no value for the run\'s environment stops in plain words', () => {
  expect(() => valueForEnv('Test=Home; Stage=hany', 'Prod')).toThrow('no value for the Prod environment');
});

test('the phone details date is dd/MM/yyyy', () => {
  expect(dmy(new Date(2026, 0, 5))).toBe('05/01/2026');
});

test('a table cell\'s time in any writing reads as HH:mm; other cells read as none', () => {
  expect(shownTime('09:00')).toBe('09:00');
  expect(shownTime(' 6:00 PM ')).toBe('18:00');
  expect(shownTime('18:00:00')).toBe('18:00');
  expect(shownTime('‏09:30 ')).toBe('09:30');
  expect(shownTime('2026-11-11')).toBeUndefined();
  expect(shownTime('تحضير')).toBeUndefined();
  expect(shownTime('12')).toBeUndefined();
});

const TABLE = {
  headers: ['#', 'التاريخ', 'توقيت الحضور', 'توقيت الانصراف', 'ساعات الدوام الفعلي', 'تأخير حضور', 'حضور مبكر', 'النقص في الدوام',
    'انصراف مبكر', 'العمل الإضافي', 'الإضافي الزائد'],
  rows: [
    ['1', 'الأربعاء 2026-11-11', '09:00', '18:00', '09:00', '00:00', '00:00', '00:00', '00:00', '00:00', '01:00'],
    ['الإجمالي', '', '', '', '09:00', '00:00', '00:00', '00:00', '00:00', '00:00', '01:00'],
  ],
};

test('the report\'s day row gives each figure by its column name (the total row is not the day)', () => {
  expect(figuresOf(TABLE)).toEqual({ checkIn: '09:00', checkOut: '18:00', actualHours: '09:00', lateArrival: '00:00',
    earlyArrival: '00:00', shortage: '00:00', earlyCheckOut: '00:00', overtime: '00:00' });
});

test('trap: the overtime figure is "العمل الإضافي", never the extra overtime column next to it', () => {
  const t = { headers: TABLE.headers, rows: [[...TABLE.rows[0].slice(0, 9), '02:00', '05:00']] };
  expect(figuresOf(t).overtime).toBe('02:00');
});

test('trap: a report with no day row gives empty figures (the check then fails), never the total row\'s', () => {
  expect(figuresOf({ headers: TABLE.headers, rows: [TABLE.rows[1]] }).actualHours).toBe('');
});

test('the details card in English is read by its labels', () => {
  const desc = '164872\nLeave-Sick leave\nStart\n25/09/2026 \nEnd\n25/09/2026\nSubmission Date\n24/09/2026\nRequest Duration\n1 Day\nNotes\nTrova leave x';
  expect(detailsOf(desc, 'Pending')).toEqual({ id: '164872', type: 'Leave-Sick leave', status: 'Pending', start: '25/09/2026',
    end: '25/09/2026', submitted: '24/09/2026', duration: '1 Day', notes: 'Trova leave x' });
});

test('the details card in Arabic is read by the app\'s own Arabic labels, in the card\'s order', () => {
  const desc = '164873\nمغادرة-إجازة مرضية\nالبداية\n26/09/2026\nتاريخ التقديم\n24/09/2026\nالنهاية\n27/09/2026\nمدة الطلب\n2 أيام\nملاحظات\nTrova leave y';
  const d = detailsOf(desc, 'تحت الإجراء');
  expect([d.start, d.end, d.submitted, d.duration, d.notes]).toEqual(['26/09/2026', '27/09/2026', '24/09/2026', '2 أيام', 'Trova leave y']);
  expect(rightToLeft(desc)).toBe(true);
  expect(rightToLeft('164872\nLeave-Sick leave')).toBe(false);
});

test('a card with labels it does not know is read by place: start, submission, end; the day count; the last line as the note', () => {
  const desc = '164874\nType\nA\n26/09/2026\nB\n24/09/2026\nC\n27/09/2026\nD\n1 يوم\nE\nTrova leave z';
  const d = detailsOf(desc, 'Pending');
  expect([d.start, d.submitted, d.end, d.duration, d.notes]).toEqual(['26/09/2026', '24/09/2026', '27/09/2026', '1 يوم', 'Trova leave z']);
});

test('the requests list words its statuses as the portal does', () => {
  expect([1, 2, 3, 4].map(statusWord)).toEqual(['مقبول', 'تحت الاجراء', 'مرفوض', 'محذوف']);
  expect(statusWord(9)).toBe('9');
});
