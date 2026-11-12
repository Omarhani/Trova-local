import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { LiveFrames } from '../../src/report/liveFrames';

function frames(now: () => number, dir: string | null = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'))) {
  const said: Record<string, unknown>[] = [];
  return { said, dir, live: new LiveFrames(dir ?? undefined, now, (t, f) => said.push({ t, ...f })) };
}

test('a picture is written into the run folder as frame-000001.jpg and announced with its step', async () => {
  const { said, dir, live } = frames(() => 10_000);
  await live.add(Buffer.from('jpg'), 3, 'jpg');
  expect(fs.readFileSync(path.join(dir!, 'frame-000001.jpg'), 'utf8')).toBe('jpg');
  expect(said).toEqual([{ t: 'frame', f: 'frame-000001.jpg', step: 3 }]);
});

test('at most one picture every 600 ms (utils.LiveFeed)', async () => {
  let now = 10_000;
  const { said, live } = frames(() => now);
  await live.add(Buffer.from('a'), 1, 'jpg');
  now += 300;
  await live.add(Buffer.from('b'), 2, 'jpg');
  now += 400;
  await live.add(Buffer.from('c'), 3, 'png');
  expect(said.map((e) => e.f)).toEqual(['frame-000001.jpg', 'frame-000002.png']);
});

test('no run folder (a run not started by Trova): no picture, no event', async () => {
  const { said, live } = frames(() => 10_000, null);
  expect(live.on()).toBe(false);
  await live.add(Buffer.from('a'), 1, 'jpg');
  expect(said).toEqual([]);
});

