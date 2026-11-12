import { expect, test } from '@playwright/test';
import { MjpegParts } from '../../src/phone/mjpegParts';
import { PhoneFilm } from '../../src/phone/phoneFilm';
import { streamCapabilities } from '../../src/phone/phoneStreamCaps';

function part(body: string): Buffer {
  return Buffer.from(`--BoundaryString\r\nContent-type: image/jpg\r\nContent-Length: ${body.length}\r\n\r\n${body}\r\n`);
}

test("the phone's picture stream gives each picture whole, as it came", () => {
  const parts = new MjpegParts();
  expect(parts.push(Buffer.concat([part('first'), part('second')])).map(String)).toEqual(['first', 'second']);
});

test('a picture split over several pieces of the stream comes out once, whole', () => {
  const parts = new MjpegParts();
  const all = part('a picture');
  expect(parts.push(all.subarray(0, 20))).toEqual([]);
  expect(parts.push(all.subarray(20, 60))).toEqual([]);
  expect(parts.push(all.subarray(60)).map(String)).toEqual(['a picture']);
});

test('the length line is read in any letter case; a part with no length is skipped', () => {
  const parts = new MjpegParts();
  const noLength = Buffer.from('--b\r\nContent-type: image/jpg\r\n\r\n');
  const lower = Buffer.from('--b\r\ncontent-length: 2\r\n\r\nok\r\n');
  expect(parts.push(Buffer.concat([noLength, lower])).map(String)).toEqual(['ok']);
});

function film() {
  const kept: { jpeg: string; step: number; every: boolean }[] = [];
  const f = new PhoneFilm(async (jpeg, step, every) => { kept.push({ jpeg: String(jpeg), step, every }); return true; });
  return { kept, f };
}

test('every new picture of the stream goes to the run with the step on screen; the same picture again is left out', async () => {
  const { kept, f } = film();
  f.atStep(2);
  await f.frame(Buffer.from('A'));
  await f.frame(Buffer.from('A'));
  await f.frame(Buffer.from('B'));
  expect(kept).toEqual([{ jpeg: 'A', step: 2, every: false }, { jpeg: 'B', step: 2, every: false }]);
});

test('after a step the next picture is always kept for it, even when the screen did not change (run 598)', async () => {
  const { kept, f } = film();
  await f.frame(Buffer.from('A'));
  expect(f.stepPicture(4)).toBe(true);
  await f.frame(Buffer.from('A'));
  await f.frame(Buffer.from('A'));
  expect(kept).toEqual([{ jpeg: 'A', step: 0, every: false }, { jpeg: 'A', step: 4, every: true }]);
});

test('no picture came yet: a step picture is not promised (the test takes its own)', () => {
  const { f } = film();
  expect(f.stepPicture(1)).toBe(false);
});

test('the phone streams its screen at Java size and better quality over USB, smaller over Wi-Fi', () => {
  expect(streamCapabilities(7811, 'R58M123')).toEqual({
    'appium:mjpegServerPort': 7811,
    'appium:settings[mjpegServerFramerate]': 5,
    'appium:settings[mjpegScalingFactor]': 50,
    'appium:settings[mjpegServerScreenshotQuality]': 75,
  });
  expect(streamCapabilities(7811, '192.168.1.9:5555')).toMatchObject({
    'appium:settings[mjpegScalingFactor]': 35,
    'appium:settings[mjpegServerScreenshotQuality]': 50,
  });
});

test("the phone server's own spacing between pictures (a blank line after each) is read the same", () => {
  const parts = new MjpegParts();
  const one = (b: string) => Buffer.from(`--BoundaryString\r\nContent-type: image/jpg\r\nContent-Length: ${b.length}\r\n\r\n${b}\r\n\r\n`);
  expect(parts.push(Buffer.concat([one('x1'), one('y22')])).map(String)).toEqual(['x1', 'y22']);
});

test('a new screen left out for being too soon is kept by its next same picture - a screen that stays is never lost', async () => {
  const kept: string[] = [];
  let open = false; // the run's pictures take one only when due
  const f = new PhoneFilm(async (jpeg) => { if (!open) return false; kept.push(String(jpeg)); return true; });
  open = true;
  await f.frame(Buffer.from('A'));
  open = false;
  await f.frame(Buffer.from('B'));
  open = true;
  await f.frame(Buffer.from('B'));
  await f.frame(Buffer.from('B'));
  expect(kept).toEqual(['A', 'B']);
});
