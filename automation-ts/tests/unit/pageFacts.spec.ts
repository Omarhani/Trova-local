import { expect, test } from '@playwright/test';
import { factsLine, onSignInPage } from '../../src/web/pageFacts';

test('the facts line names the address and the visible menu texts, short and plain', () => {
  const line = factsLine('https://portal.x/home?a=1', ['Home', 'Registration Requests', '', 'Home']);
  expect(line).toBe('Page at the failure: https://portal.x/home - menu: Home | Registration Requests');
});

test('a long menu is cut, never the whole page', () => {
  const many = Array.from({ length: 80 }, (_, i) => `Item ${i}`);
  expect(factsLine('https://x/', many).length).toBeLessThanOrEqual(600);
});

test('a sign-in address means the app did not open signed in', () => {
  expect(onSignInPage('https://portal.x/auth/login')).toBe(true);
  expect(onSignInPage('https://portal.x/#/signin')).toBe(true);
  expect(onSignInPage('https://portal.x/pending-requests')).toBe(false);
});
