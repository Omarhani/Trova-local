import { expect, test } from '@playwright/test';
import { PHONE_HEADERS, phoneEnvelope } from '../../src/api/phoneEnvelope';

test('a phone call body goes in the app\'s envelope with the user and a request id', () => {
  expect(phoneEnvelope('u-1', { State: 0 }, 'r-1')).toEqual({
    UserID: 'u-1', PageNumber: 1, PageSize: 10, TimeZoneOffset: -180, RequstId: 'r-1', Data: { State: 0 },
  });
});

test('before the sign-up the user is empty and a bare text is the Data', () => {
  expect(phoneEnvelope('', 'o.hany', 'r-2')).toMatchObject({ UserID: '', Data: 'o.hany' });
});

test('the phone side sends the app\'s language and kind headers, no key of a login', () => {
  expect(PHONE_HEADERS).toEqual({ Language: '0', type: 'flutter' });
});
