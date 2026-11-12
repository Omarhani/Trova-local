import { expect, test } from '@playwright/test';
import { Box, setChecked, tapPoints } from '../../src/core/checkTap';

/** Test 8094 run 579: the TS sign-in tapped near the row's edge and went on unseen - the AI-run rule (run 567) is shared now. */
const row: Box = { id: 'server_checkbox_Test', bounds: [0, 100, 600, 160], checked: false };

test('a box that is a whole row is tapped at its tick: the row start, then its end, then its middle', () => {
  expect(tapPoints(row.bounds)).toEqual([[30, 130], [570, 130], [300, 130]]);
});

test('a small box is tapped in its middle', () => {
  expect(tapPoints([10, 10, 50, 50])).toEqual([[30, 30]]);
});

test('the state is read back: a tap that ticks is done after one tap', async () => {
  const taps: number[][] = [];
  let state = false;
  await setChecked(row, true, { tap: async (x, y) => { taps.push([x, y]); state = true; }, read: async () => ({ ...row, checked: state }), wait: async () => {} });
  expect(taps).toEqual([[30, 130]]);
});

test('a tap that did not tick goes to the next point', async () => {
  const taps: number[][] = [];
  let state = false;
  await setChecked(row, true, { tap: async (x, y) => { taps.push([x, y]); if (taps.length === 2) state = true; }, read: async () => ({ ...row, checked: state }), wait: async () => {} });
  expect(taps).toEqual([[30, 130], [570, 130]]);
});

test('trap: a box that never ticks fails honestly, never a step reported unseen', async () => {
  await expect(setChecked(row, true, { tap: async () => {}, read: async () => row, wait: async () => {} }))
    .rejects.toThrow('could not tick the "Test" box');
});

test('a box already as wanted is not tapped', async () => {
  let tapped = false;
  await setChecked({ ...row, checked: true }, true, { tap: async () => { tapped = true; }, read: async () => row, wait: async () => {} });
  expect(tapped).toBe(false);
});
