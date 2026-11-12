import { expect, test } from '@playwright/test';
import { ClockTime } from '../../src/web/clockTime';

test('"6 pm", "18:00", "6:30 PM" and "6.30 p.m." are read as the same clock time (utils.ClockTime)', () => {
  expect(ClockTime.parse('6 pm').hour24).toBe(18);
  expect(ClockTime.parse('18:00').matches('6:00 pm')).toBe(true);
  expect(ClockTime.parse('6:30 PM').matches('18:30')).toBe(true);
  expect(ClockTime.parse('6.30 p.m.').minute).toBe(30);
});

test('Arabic digits and ص / م are read', () => {
  expect(ClockTime.parse('٦:٣٠ م').matches('18:30')).toBe(true);
  expect(ClockTime.parse('٩ ص').hour24).toBe(9);
});

test('midnight and noon on a 12-hour clock: 12 am is 0, 12 pm is 12', () => {
  expect(ClockTime.parse('12 am').hour24).toBe(0);
  expect(ClockTime.parse('12 pm').hour24).toBe(12);
  expect(ClockTime.parse('00:00').hour12()).toBe(12);
  expect(ClockTime.parse('00:00').pm()).toBe(false);
});

test('a wrong time fails in plain words', () => {
  for (const wrong of ['25:00', '13:00 pm', '0:00 am', '10:60', 'soon', '']) {
    expect(() => ClockTime.parse(wrong)).toThrow(`"${wrong}" is not a time - write it like 18:00 or 6:00 pm`);
  }
});

test('an empty or other value shown is not a match', () => {
  const t = ClockTime.parse('9:05 am');
  expect(t.matches('')).toBe(false);
  expect(t.matches('9:06 am')).toBe(false);
  expect(t.matches('09:05')).toBe(true);
});

test('the headers, the 24-hour inner ring and the text', () => {
  const t = ClockTime.parse('21:07');
  expect([t.hourHeader(), t.minuteHeader(), t.innerRing24(), String(t)]).toEqual(['09', '07', true, '9:07 pm']);
  expect(ClockTime.parse('12:00').innerRing24()).toBe(false);
  expect(ClockTime.parse('0:00').innerRing24()).toBe(true);
});

test('a number sits on the face: 12 / 0 at the top, 3 to the right, 30 minutes at the bottom', () => {
  expect(ClockTime.offset(12, 12, 100)).toEqual([0, -100]);
  expect(ClockTime.offset(3, 12, 100)).toEqual([100, 0]);
  expect(ClockTime.offset(30, 60, 100)).toEqual([0, 100]);
});
