import { expect, test } from '@playwright/test';
import { firstSideWithGates, noSideWithGates } from '../../src/web/pages/sideWithGates';

/** a fake department list: which ones have gates; the ones looked at, in order */
function sides(withGates: boolean[]) {
  const looked: number[] = [];
  const hasGates = async (i: number) => {
    looked.push(i);
    return withGates[i];
  };
  return { looked, hasGates };
}

test('a department with no gates is skipped: the next one with gates is picked (run 913)', async () => {
  const s = sides([false, true, true]);
  expect(await firstSideWithGates(3, s.hasGates)).toBe(1);
  expect(s.looked).toEqual([0, 1]);
});

test('the first department is kept when it has gates, no other is looked at', async () => {
  const s = sides([true, false]);
  expect(await firstSideWithGates(2, s.hasGates)).toBe(0);
  expect(s.looked).toEqual([0]);
});

test('no department with gates: none is picked', async () => {
  const s = sides([false, false]);
  expect(await firstSideWithGates(2, s.hasGates)).toBeUndefined();
  expect(s.looked).toEqual([0, 1]);
});

test('an empty department list: none is picked and nothing is looked at', async () => {
  const s = sides([]);
  expect(await firstSideWithGates(0, s.hasGates)).toBeUndefined();
  expect(s.looked).toEqual([]);
});

test('the reason in plain words says what the case needs', () => {
  expect(noSideWithGates(3)).toBe('Not tested - needs a department with gates: none of the 3 departments in the movement form has a gate');
});
