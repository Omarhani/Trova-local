import { expect, test } from '@playwright/test';
import { maskLogText } from '../../src/report/logMask';
import { maskBody, maskUrl } from '../../src/report/networkEvents';

test('an auth header, cookie or API key in a log line keeps its name, never its value', () => {
  expect(maskLogText('Authorization: Bearer eyJabc.def.ghi')).toBe('Authorization: ***');
  expect(maskLogText('Cookie: sid=1; theme=dark')).toBe('Cookie: ***');
  expect(maskLogText('set-cookie=abc')).toBe('set-cookie: ***');
  expect(maskLogText('x-api-key: k-123')).toBe('x-api-key: ***');
});

test('a bearer token or a signed token anywhere in a line is masked', () => {
  expect(maskLogText('sent with Bearer abc.DEF-123 to the server')).toBe('sent with Bearer *** to the server');
  expect(maskLogText('kept eyJhbGciOi.eyJzdWIi.sig_1-x in memory')).toBe('kept *** in memory');
});

test('password, token, OTP or PIN written as name=value or name: value is masked', () => {
  expect(maskLogText('login failed password=p@1 user=o')).toBe('login failed password=*** user=o');
  expect(maskLogText('otp: 123456')).toBe('otp: ***');
  expect(maskLogText('pin=0000, tries=2')).toBe('pin=***, tries=2');
});

test('a JSON body and an address in a line are masked as the Network masks them', () => {
  expect(maskLogText('body {"Password":"p","Name":"n"} to https://a.sa/x?token=t&b=1'))
    .toBe('body {"Password":"***","Name":"n"} to https://a.sa/x?token=***&b=1');
});

test('a plain line stays as it is', () => {
  expect(maskLogText('Unable to load the list: timeout after 30 s')).toBe('Unable to load the list: timeout after 30 s');
});

test('an OTP or PIN in a body or an address is masked; a word that only contains "otp" is not', () => {
  expect(maskBody('{"otp":"1234","otpCode":99,"pin":"0000","footprint":"x"}')).toBe('{"otp":"***","otpCode":"***","pin":"***","footprint":"x"}');
  expect(maskUrl('https://a.sa/v?otp=1234&footprint=1')).toBe('https://a.sa/v?otp=***&footprint=1');
});
