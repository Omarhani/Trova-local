import { expect, test } from '@playwright/test';
import { phoneTest } from '../../src/phone/phoneTest';
import { checkTrue } from '../../src/report/checks';
import { runStops } from '../../src/run/runStops';

/**
 * Round 2 review (test partner): a phone held by something else stops the run's phone cases, but the clean-up still
 * runs - as in tests/mobile/leaveRequest, whose clean-up by API sits in the phone spec and never uses the phone.
 */

const RUN = 'r2-review-phone-stop';
const before = process.env.TROVA_RUN_ID;
const ran: string[] = [];

test.beforeAll(() => {
  process.env.TROVA_RUN_ID = RUN;
  runStops.save({ phone: 'The phone is used by something else (another test session drives it) - waited 2 min, the case could not run' });
});

test.afterAll(() => {
  runStops.forget();
  if (before === undefined) delete process.env.TROVA_RUN_ID;
  else process.env.TROVA_RUN_ID = before;
});

phoneTest('cleanUpLeaveRequestsProgrammatically', async () => {
  ran.push('clean-up');
  checkTrue("Clean-up · the leave requests this run sent are gone from the employee's list", true);
});

test('the phone was held: the clean-up of the phone spec still ran', () => {
  expect(ran).toEqual(['clean-up']);
});
