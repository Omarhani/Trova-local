import { expect, test } from '@playwright/test';
import { projectCode, recorded } from './makeFixtures';
import { cyclePicture } from '../../../src/make/cyclePicture';
import { makeAutomation } from '../../../src/make/makeAutomation';
import { KnowledgePick, MadeRun } from '../../../src/make/madeRun';

/**
 * Hand-over 2026-11-14: the automation maker takes the knowledge Trova picked for the case (business rules, entities,
 * actors and App map pages that match its words - the same picks the AI runs and chat get). The test says which business
 * it follows and where each piece comes from; a page the App map knows names its new page class.
 */
const RULE: KnowledgePick = { kind: 'rule', areaId: 7, name: 'Holidays', text: 'A holiday name is unique in a year', source: 'Business > Holidays' };
const ENTITY: KnowledgePick = { kind: 'entity', areaId: 7, name: 'Holiday', text: 'name, date', source: 'Business > Holidays' };
const ACTOR: KnowledgePick = { kind: 'actor', areaId: 2, name: 'HR admin', text: 'adds and removes holidays', source: 'Business > Actors' };
const PAGE: KnowledgePick = { kind: 'page', name: 'Public holidays page', text: 'open `/holidays`; known elements: Search', source: 'App map > Public holidays page' };

function withKnowledge(name: string, picks: KnowledgePick[]): MadeRun {
  return { ...recorded(name), knowledge: picks };
}

test('red first: the picture names the business rules, entities and actors the case follows, each with where it comes from', () => {
  const p = cyclePicture(withKnowledge('hybrid', [RULE, ENTITY, ACTOR]));
  expect(p).toContain('Business rule: A holiday name is unique in a year (from Business > Holidays)');
  expect(p).toContain('Business record: Holiday - name, date (from Business > Holidays)');
  expect(p).toContain('Business actor: HR admin - adds and removes holidays (from Business > Actors)');
});

test('the App map pages the case touches are named in plain words, never their addresses', () => {
  const p = cyclePicture(withKnowledge('hybrid', [PAGE]));
  expect(p).toContain('App map: Public holidays page');
  expect(p.join('\n')).not.toContain('/holidays');
});

test('no knowledge picked (an older record): the picture is as before', () => {
  expect(cyclePicture(withKnowledge('hybrid', []))).toEqual(cyclePicture(recorded('hybrid')));
  expect(cyclePicture(recorded('hybrid')).join('\n')).not.toContain('Business ');
});

test('the test opens with the business it follows', () => {
  const d = makeAutomation(withKnowledge('hybrid', [RULE]), projectCode());
  expect(d.spec.text).toContain(' * Business rule: A holiday name is unique in a year (from Business > Holidays)');
});

test('red first: a page with no class yet gets the name the App map gives it', () => {
  const d = makeAutomation(withKnowledge('hybrid', [PAGE]), projectCode());
  expect(d.files.map((f) => f.path)).toContain('src/web/pages/PublicHolidaysPage.ts');
  expect(d.spec.text).toContain('PublicHolidaysPage');
});

test('boundary: an App map page for another address never renames this page', () => {
  const other: KnowledgePick = { ...PAGE, name: 'Holiday requests page', text: 'open `/holidays/requests`' };
  const d = makeAutomation(withKnowledge('hybrid', [other]), projectCode());
  expect(d.spec.text).not.toContain('HolidayRequestsPage');
  expect(d.spec.text).toContain('HolidaysPage');
});

test('a page class Trova already linked wins over the App map name', () => {
  const run = withKnowledge('hybrid', [PAGE]);
  run.steps.forEach((s) => s.actions.forEach((a) => { if (a.on === 'web') a.pageClass = 'HolidaysPage'; }));
  const d = makeAutomation(run, projectCode());
  expect(d.spec.text).not.toContain('PublicHolidaysPage');
});

test('trap: a knowledge text that tries to close the comment cannot break the test file', () => {
  const p = cyclePicture(withKnowledge('hybrid', [{ ...RULE, text: 'ends here */ evil()' }]));
  expect(p.join('\n')).not.toContain('*/');
});
