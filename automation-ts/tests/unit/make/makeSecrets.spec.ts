import { expect, test } from '@playwright/test';
import { makeAutomation } from '../../../src/make/makeAutomation';
import { everyText, expectMade, made, projectCode, recorded, TECH } from './makeFixtures';

/**
 * Make automation - secrets never in code: a value typed from a saved login is read by the login's name at run time
 * (Test Data > Credentials, the run's saved sign-in); a password, token or other secret value of the run is never
 * written - not in a class, the test, its trap or the suite's values.
 */
const SECRETS = ['Fixture-Only-Pass-1', 'Fixture-Only-Pass-2', 'Fixture-Only-Pass-3', 'fixture-token-123'];

test('no secret value of the run reaches anything Trova would write', () => {
  const d = made('secrets');
  expectMade(d);
  const all = everyText(d);
  for (const s of SECRETS) expect(all).not.toContain(s);
});

test('a field typed from a saved login is read by the login\'s name when the test runs', () => {
  const d = made('secrets');
  expect(d.spec.text).toMatch(/credentials\.get\(\s*'Mail box',\s*'Password'\s*\)/);
});

test('a secret value of the case is never a suite value', () => {
  const d = made('secrets');
  expect(d.suiteBlocks).not.toMatch(/mail_password/);
  expect(d.suiteBlocks).toContain('<parameter name="mail_user" value="fixture.mail@example.test"/>');
});

test('the run\'s own sign-in and the call\'s sign-in headers are never written - the run signs in once by itself', () => {
  const d = made('secrets');
  expectMade(d);
  expect(everyText(d)).not.toMatch(/Authorization|Bearer/i);
  expect(everyText(d)).not.toContain("@type='password'"); // the AI's sign-in step is not made into code
});

test('a secret the code cannot read by a login\'s name refuses the draft in plain words, without the value', () => {
  const run = recorded('secrets');
  run.setup[0] = { ...run.setup[0], body: { UserName: '{mail_user}', Password: 'Fixture-Only-Pass-4' } } as typeof run.setup[0];
  const d = makeAutomation(run, projectCode());
  expect(d.refused).toMatch(/login/i);
  expect(d.refused).not.toContain('Fixture-Only-Pass-4');
  expect(d.refused).not.toMatch(TECH);
  expect(everyText(d)).not.toContain('Fixture-Only-Pass-4');
});
