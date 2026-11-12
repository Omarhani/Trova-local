import { expect, test } from '@playwright/test';
import { tapUntilOpened } from '../../src/core/tapUntilOpened';

/** a screen that opens after the given tap (0 = never) */
function screen(opensOnTap: number): { taps: () => number; io: { tap: () => Promise<void>; opened: (s: number) => Promise<boolean> } } {
  let taps = 0;
  return {
    taps: () => taps,
    io: { tap: async () => { taps++; }, opened: async () => opensOnTap > 0 && taps >= opensOnTap },
  };
}

/** Jenkins mobPassword #2: a tap while My Profile still loaded opened nothing - tapped again (Java tapAgainIfNothingChanged), no fixed 3 s settle */
test('a tap that opens the screen is not repeated', async () => {
  const s = screen(1);
  expect(await tapUntilOpened(s.io)).toBe(true);
  expect(s.taps()).toBe(1);
});

test('a tap that opened nothing is tapped again', async () => {
  const s = screen(2);
  expect(await tapUntilOpened(s.io)).toBe(true);
  expect(s.taps()).toBe(2);
});

test('trap: a screen that never opens gives up after the tries, false', async () => {
  const s = screen(0);
  expect(await tapUntilOpened(s.io, 3)).toBe(false);
  expect(s.taps()).toBe(3);
});

test('the wait for each tap is the seconds given', async () => {
  const waited: number[] = [];
  await tapUntilOpened({ tap: async () => undefined, opened: async (sec) => { waited.push(sec); return false; } }, 2, 4);
  expect(waited).toEqual([4, 4]);
});
