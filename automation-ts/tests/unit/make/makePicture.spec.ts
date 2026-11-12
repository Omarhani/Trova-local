import { expect, test } from '@playwright/test';
import { made, recorded } from './makeFixtures';
import { cyclePicture } from '../../../src/make/cyclePicture';

/**
 * Make automation - the cycle picture: before the code, the business cycle of the case in plain words (who, what is made
 * first and why, the steps in order, what is checked, what is undone at the end). The tester reads it before saving; it
 * sits at the top of the test and goes into the business knowledge once saved.
 */
test('the picture says who acts, what is made first and why, the steps, the checks and what is undone', () => {
  const p = cyclePicture(recorded('hybrid'));
  expect(p).toContain('Who: Admin');
  expect(p).toContain('Made first: holiday - step 2 uses it');
  expect(p).toContain('Steps: 1. Open the Holidays page > 2. Search for the holiday');
  expect(p).toContain('Checked: The holiday shows with its date');
  expect(p).toContain('Undone at the end: holiday');
});

test('a set-up no step uses is flagged for the tester', () => {
  const run = recorded('hybrid');
  run.steps[2].actions[0] = { ...run.steps[2].actions[0], value: 'something else' } as typeof run.steps[2]['actions'][0];
  run.steps[2].saw = ['Holidays'];
  expect(cyclePicture(run)).toContain('Made first: holiday - no step uses it, check why it is made');
});

test('a case with nothing made first and nothing to undo says so', () => {
  const p = cyclePicture(recorded('phone'));
  expect(p).toContain('Who: Mobile user');
  expect(p).toContain('Made first: nothing');
  expect(p).toContain('Undone at the end: nothing');
  expect(p.join('\n')).not.toMatch(/xpath|AppiumBy|\/Holiday\//);
});

test('the draft carries the picture and the test opens with it', () => {
  const d = made('hybrid');
  expect(d.picture).toEqual(cyclePicture(recorded('hybrid')));
  expect(d.spec.text).toContain(' * Who: Admin');
  expect(d.spec.text.indexOf('Made first: holiday')).toBeLessThan(d.spec.text.indexOf("test('"));
});
