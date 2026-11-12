import { expect, test } from '@playwright/test';
import { openKeepingEnd } from '../../src/web/openKeepingEnd';

/** run 960 case 529: a case BLOCKED while its page opened kept no picture - the screen at that moment is kept first */
test('a page that did not open keeps the screen, then the reason goes on', async () => {
  const kept: string[] = [];
  const slow = new Error("The app's page did not open within 30 s");
  await expect(openKeepingEnd(async () => { throw slow; }, async () => { kept.push('screen'); })).rejects.toBe(slow);
  expect(kept).toEqual(['screen']);
});

test('a page that opened keeps nothing yet (the test end keeps its screen)', async () => {
  const kept: string[] = [];
  await openKeepingEnd(async () => undefined, async () => { kept.push('screen'); });
  expect(kept).toEqual([]);
});

test('a screen that cannot be taken never hides the reason', async () => {
  const slow = new Error('slow');
  await expect(openKeepingEnd(async () => { throw slow; }, async () => { throw new Error('no picture'); })).rejects.toBe(slow);
});
