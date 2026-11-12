import { expect, test } from '@playwright/test';
import { planNameSeen, withFirstPlanRenamed } from '../../src/web/changedPlanList';

/**
 * Self-healing trap (Omar 2026-11-11, case 6): the app's plan list answer with its first plan's name changed, so the page
 * shows a name the server does not have - the case must end FAILED and never be healed.
 */
const LIST = { Success: true, Data: { List: [{ ID: 7, Name: 'Plan A' }, { ID: 8, Name: 'Plan B' }] } };

test('the first plan of a Data.List answer gets the changed name; the real and shown names are said', () => {
  const c = withFirstPlanRenamed(LIST, ' (changed)');
  expect(c?.real).toBe('Plan A');
  expect(c?.shown).toBe('Plan A (changed)');
  expect((c?.answer as typeof LIST).Data.List.map((p) => p.Name)).toEqual(['Plan A (changed)', 'Plan B']);
});

test('the answer the server gave is not changed itself', () => {
  withFirstPlanRenamed(LIST, ' (changed)');
  expect(LIST.Data.List[0].Name).toBe('Plan A');
});

test('a Data array answer (no List) is changed the same way', () => {
  const c = withFirstPlanRenamed({ Data: [{ Name: 'Only' }] }, ' x');
  expect(c?.real).toBe('Only');
  expect((c?.answer as { Data: Array<{ Name: string }> }).Data[0].Name).toBe('Only x');
});

test('no plan in the answer = nothing to change', () => {
  expect(withFirstPlanRenamed({ Data: { List: [] } }, ' x')).toBeUndefined();
  expect(withFirstPlanRenamed(null, ' x')).toBeUndefined();
});

test('a first plan with no name = nothing to change', () => {
  expect(withFirstPlanRenamed({ Data: { List: [{ ID: 1, Name: '  ' }] } }, ' x')).toBeUndefined();
});

test('the name seen in the page: the real one when it shows', () => {
  expect(planNameSeen(['Plan A', 'Plan B'], 'Plan A', 'Plan A (changed)')).toBe('Plan A');
});

test('the name seen in the page: the changed one when the real one is missing', () => {
  expect(planNameSeen(['Plan A (changed)', 'Plan B'], 'Plan A', 'Plan A (changed)')).toBe('Plan A (changed)');
});

test('the name seen in the page: said plainly when neither shows', () => {
  expect(planNameSeen([], 'Plan A', 'Plan A (changed)')).toBe('no plan of that name in the list');
});
