import { expect, test } from '@playwright/test';
import { robotCheckIn, robotWords } from '../../src/web/signin/robotCheck';

test('a visible "I\'m not a robot" box or its picture challenge is a robot check', () => {
  expect(robotCheckIn([{ url: 'https://www.google.com/recaptcha/api2/anchor?k=1&size=normal', visible: true }])).toBe(true);
  expect(robotCheckIn([{ url: 'https://www.google.com/recaptcha/enterprise/bframe?k=1', visible: true }])).toBe(true);
  expect(robotCheckIn([{ url: 'https://newassets.hcaptcha.com/captcha/v1/x', visible: true }])).toBe(true);
  expect(robotCheckIn([{ url: 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x', visible: true }])).toBe(true);
});

test('the invisible score check, a hidden frame or another frame is not a blocking robot check', () => {
  expect(robotCheckIn([{ url: 'https://www.google.com/recaptcha/api2/anchor?k=1&size=invisible', visible: true }])).toBe(false);
  expect(robotCheckIn([{ url: 'https://www.google.com/recaptcha/api2/anchor?k=1', visible: false }])).toBe(false);
  expect(robotCheckIn([{ url: 'https://maps.google.com/x', visible: true }])).toBe(false);
});

test('the reason says it plainly and never offers to get around the check', () => {
  const w = robotWords('Availo', 'Admin');
  expect(w).toContain('robot check');
  expect(w).toContain('Admin');
  expect(w).not.toMatch(/bypass|solve|skip the check/i);
});
