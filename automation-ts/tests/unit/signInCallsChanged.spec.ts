import { expect, test } from '@playwright/test';
import { callsChanged } from '../../src/signin/signInCallsChanged';

test('a sign-in call that is not there any more (404 / 405 / 410) means the app\'s sign-in calls changed', () => {
  for (const s of [404, 405, 410]) {
    expect(callsChanged(`The app refused the sign-in: User/Login answered HTTP ${s}`))
      .toBe(`The app's sign-in calls changed - learn again (User/Login gave HTTP ${s})`);
  }
});

test('an answer that is not the app\'s JSON any more, or no token, means the calls changed', () => {
  expect(callsChanged('Unexpected token < in JSON at position 0')).toBe("The app's sign-in calls changed - learn again (its answer is not what it was)");
  expect(callsChanged('The sign-in as Admin gave no token')).toBe("The app's sign-in calls changed - learn again (its answer has no token any more)");
});

test('a refusal in the app\'s own words is not a change of its calls', () => {
  expect(callsChanged('The app refused the call Account/GetAccountIdByCode: wrong code')).toBeUndefined();
  expect(callsChanged('The app refused the sign-in: User/Login answered HTTP 401')).toBeUndefined();
});
