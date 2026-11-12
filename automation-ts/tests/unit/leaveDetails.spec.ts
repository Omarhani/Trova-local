import { expect, test } from '@playwright/test';
import { detailsOf, isDetailsCard, isOneDay } from '../../src/phone/screens/leaveDetails';

/** run 720 (Omar 2026-11-11): the request's details in Arabic - the card is found and read with Arabic digits */

test('run 720: the Arabic card writes its dates in Arabic digits - read as the same dd/MM/yyyy dates', () => {
  const d = detailsOf('164918\nاجازة-مرضية\nالبداية\n١٦/١١/٢٠٢٦ \nتاريخ التقديم\n١١/١١/٢٠٢٦\nالنهاية\n١٦/١١/٢٠٢٦ \nمدة الطلب\nيوم واحد\nملاحظات\nTrova leave details c8hkk0', 'تحت الإجراء');
  expect(d).toMatchObject({ id: '164918', start: '16/11/2026', end: '16/11/2026', submitted: '11/11/2026', notes: 'Trova leave details c8hkk0' });
  expect(isDetailsCard('164918\nاجازة-مرضية\nالبداية\n١٦/١١/٢٠٢٦ \nالنهاية')).toBe(true);
});

test('one day reads "1 Day" in English and "يوم واحد" in Arabic; two days is not one', () => {
  expect(isOneDay('1 Day')).toBe(true);
  expect(isOneDay('يوم واحد')).toBe(true);
  expect(isOneDay('2 Days')).toBe(false);
  expect(isOneDay('يومان')).toBe(false);
});
