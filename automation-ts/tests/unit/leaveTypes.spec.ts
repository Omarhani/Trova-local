import { expect, test } from '@playwright/test';
import { leaveKindOf } from '../../src/data/leaveTypes';

/** the phone app's GET Leaves/LeaveTypes answer (Test, 2026-11-11): categories with their sub types */
const TYPES = [
  { ID: 1, NameAr: 'استئذان', NameEn: 'Excuses', SubTypes: [{ ID: 1, NameAr: 'شخصي', NameEn: 'Personal' }] },
  { ID: 2, NameAr: 'اجازة', NameEn: 'Leave', SubTypes: [{ ID: 12, NameAr: 'سنوية', NameEn: 'Annual' }, { ID: 3, NameAr: 'مرضية', NameEn: 'Sick leave' }] },
];

test('a leave type is found by its English name, any case, with its category', () => {
  expect(leaveKindOf(TYPES, 'sick LEAVE')).toEqual({ categoryId: 2, typeId: 3, nameEn: 'Sick leave', nameAr: 'مرضية' });
});

test('a leave type is found by its Arabic name too', () => {
  expect(leaveKindOf(TYPES, ' سنوية ').typeId).toBe(12);
});

test('trap: a type the app does not have stops with the names it has', () => {
  expect(() => leaveKindOf(TYPES, 'Holiday')).toThrow('The app has no leave type "Holiday" (it has: Personal, Annual, Sick leave)');
});

test('an answer without sub types gives a plain error, never a guessed type', () => {
  expect(() => leaveKindOf([{ ID: 2, NameEn: 'Leave' }], 'Sick leave')).toThrow('no leave type "Sick leave"');
});
