import { expect, test } from '@playwright/test';
import { LogLine } from '../../src/phone/phoneProblems';
import { NO_APP_CALLS, PhoneLogFeed } from '../../src/phone/phoneLogFeed';

/** a stand-in phone log: the app (4321, later 5555 after a restart), another app (999) and the system (1000) */
const at = (pid: number, tid: number, level: string, tag: string, text: string): LogLine =>
  ({ timestamp: 1000, level: 'ALL', message: `11-10 12:00:00.000  ${pid}  ${tid} ${level} ${tag}: ${text}` });

function feedOf(batches: LogLine[][], pids: number[][] = [[4321]], max?: number) {
  const events: Array<[string, Record<string, unknown>]> = [];
  let n = 0;
  let p = 0;
  const feed = new PhoneLogFeed({
    readLog: async () => batches[n++] ?? [],
    appPids: async () => pids[Math.min(p++, pids.length - 1)],
    appPackage: 'com.example.shop',
    emit: (t, f) => events.push([t, f]),
    ...(max ? { maxProblems: max } : {}),
  });
  return { feed, events };
}

test("a read of the log sends the app's warnings and errors as Problems, other apps left out", async () => {
  const { feed, events } = feedOf([[at(4321, 4321, 'E', 'Api', 'save failed'), at(999, 999, 'E', 'Gmail', 'sync'), at(4321, 4321, 'I', 'flutter', 'hi')]]);
  await feed.drain();
  expect(events).toEqual([['console', { level: 'error', text: 'Api: save failed' }]]);
});

test("the app's own calls written to the log go to Network as calls, masked like the web's", async () => {
  const { feed, events } = feedOf([[
    at(4321, 7, 'I', 'okhttp.OkHttpClient', '--> GET https://a.sa/api/Me?token=t'),
    at(4321, 7, 'I', 'okhttp.OkHttpClient', '<-- 500 https://a.sa/api/Me?token=t (12ms)'),
    at(4321, 7, 'I', 'okhttp.OkHttpClient', '<-- END HTTP'),
  ]]);
  await feed.drain();
  expect(events).toHaveLength(1);
  expect(events[0][0]).toBe('call');
  expect(events[0][1]).toMatchObject({ m: 'GET', p: '/api/Me?token=***', s: 500, ms: 12, bad: true });
  expect(events[0][1].api).toBeUndefined();
});

test('the app started again (new process) is still the app', async () => {
  const { feed, events } = feedOf([[at(4321, 1, 'E', 'Api', 'one')], [at(5555, 1, 'E', 'Api', 'two')]], [[4321], [5555]]);
  await feed.drain();
  await feed.drain();
  expect(events.map((e) => e[1].text)).toEqual(['Api: one', 'Api: two']);
});

test('the same problem line is sent once per case', async () => {
  const { feed, events } = feedOf([[at(4321, 1, 'E', 'Api', 'same'), at(4321, 1, 'E', 'Api', 'same')], [at(4321, 1, 'E', 'Api', 'same')]]);
  await feed.drain();
  await feed.drain();
  expect(events).toHaveLength(1);
});

test('problems stop at the cap and the end says how many more were left out', async () => {
  const { feed, events } = feedOf([[1, 2, 3, 4].map((i) => at(4321, 1, 'W', 'Api', `w${i}`))], [[4321]], 2);
  await feed.finish();
  expect(events.filter((e) => e[0] === 'console').map((e) => e[1].text)).toEqual(['Api: w1', 'Api: w2', '2 more warnings and errors of the app were left out']);
});

test("a case where the app wrote none of its calls says so once on Network, in plain words", async () => {
  const { feed, events } = feedOf([[at(4321, 1, 'E', 'Api', 'x')]]);
  await feed.finish();
  await feed.finish();
  expect(events.filter((e) => e[0] === 'note')).toEqual([['note', { area: 'net', text: NO_APP_CALLS }]]);
});

test('no note when the app wrote its calls', async () => {
  const { feed, events } = feedOf([[at(4321, 7, 'I', 'okhttp', '--> GET https://a.sa/x'), at(4321, 7, 'I', 'okhttp', '<-- 200 OK https://a.sa/x (1ms)')]]);
  await feed.finish();
  expect(events.map((e) => e[0])).toEqual(['call']);
});

test('a log that cannot be read, or an app not running, never fails the case', async () => {
  const events: unknown[] = [];
  const feed = new PhoneLogFeed({ readLog: async () => { throw new Error('gone'); }, appPids: async () => { throw new Error('gone'); },
    appPackage: 'com.example.shop', emit: (t, f) => events.push([t, f]) });
  await feed.drain();
  await feed.finish();
  expect(events).toEqual([['note', { area: 'net', text: NO_APP_CALLS }]]);
});

// Omar 2026-11-10: a case's report shows only what happened in that case
test('a line written before the case starts is left out', async () => {
  const line = (time: string, text: string): LogLine => ({ timestamp: 1000, level: 'ALL', message: `11-10 ${time}  4321  4321 E Api: ${text}` });
  const events: Array<[string, Record<string, unknown>]> = [];
  const feed = new PhoneLogFeed({
    readLog: async () => [line('11:59:59.900', 'old crash'), line('12:00:04.999', 'just before'), line('12:00:05.000', 'at the start'), line('12:00:09.100', 'later')],
    appPids: async () => [4321], appPackage: 'com.example.shop', emit: (t, f) => events.push([t, f]),
    since: Promise.resolve('11-10 12:00:05'),
  });
  await feed.drain();
  expect(events.map((e) => e[1].text)).toEqual(['Api: at the start', 'Api: later']);
});
