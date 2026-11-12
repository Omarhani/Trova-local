import { expect, test } from '@playwright/test';
import { appAnswer } from '../../src/api/appAnswer';

/** Test 8094 run 575: the app said no (Result false) and the run only said "expected true" - its own words now come along. */
test('Result false is a refusal with the app own message', () => {
  expect(appAnswer({ status: 200, text: JSON.stringify({ Result: false, Message: 'يوجد طلب عمل إضافي قائم لهذا اليوم' }) }))
    .toEqual({ ok: false, message: 'يوجد طلب عمل إضافي قائم لهذا اليوم' });
});

test('Status false is a refusal too, message in any case', () => {
  expect(appAnswer({ status: 200, text: JSON.stringify({ Status: false, message: 'no' }) })).toEqual({ ok: false, message: 'no' });
});

test('a 2xx answer without a false flag is taken', () => {
  expect(appAnswer({ status: 200, text: JSON.stringify({ Result: true, Data: 5 }) })).toEqual({ ok: true, message: '' });
});

test('an HTTP error is a refusal that names the status', () => {
  expect(appAnswer({ status: 400, text: '' })).toEqual({ ok: false, message: 'HTTP 400' });
});
