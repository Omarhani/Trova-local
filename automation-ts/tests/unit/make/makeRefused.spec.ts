import { expect, test } from '@playwright/test';
import { makeAutomation } from '../../../src/make/makeAutomation';
import { projectCode, recorded, TECH } from './makeFixtures';

/**
 * Make automation - a test that checks nothing is never made: no step of the run has an expected result the AI saw (or,
 * for a call, an answer it checked). Nor is a run that did not pass. The tester reads why in plain words.
 */
test('a run with no checked expected result is refused, with nothing to save', () => {
  const d = makeAutomation(recorded('noCheck'), projectCode());
  expect(d.refused).toBeTruthy();
  expect(d.refused).toMatch(/expected result/i);
  expect(d.refused).not.toMatch(TECH);
  expect(d.files).toEqual([]);
  expect(d.suiteBlocks).toBe('');
});

test('an expected result written but never seen by the AI is no check either', () => {
  const run = recorded('webUi');
  delete run.steps[4].saw;
  expect(makeAutomation(run, projectCode()).refused).toMatch(/expected result/i);
});

test('a call whose answer was never checked is no check', () => {
  const run = recorded('api');
  for (const s of run.steps) {
    delete s.expected;
    for (const a of s.actions) if (a.on === 'api') { delete a.status; delete a.says; }
  }
  expect(makeAutomation(run, projectCode()).refused).toMatch(/expected result/i);
});

test('a run with a step that did not pass is refused', () => {
  const run = recorded('webUi');
  run.steps[3].result = 'failed';
  const d = makeAutomation(run, projectCode());
  expect(d.refused).toMatch(/pass/i);
  expect(d.refused).not.toMatch(TECH);
  expect(d.files).toEqual([]);
});
