import { expect, test } from '@playwright/test';
import type { TestCase, TestResult } from '@playwright/test/reporter';
import LiveReporter from '../../src/report/liveReporter';
import { KIND_NOTE } from '../../src/report/failureKind';

/** Round 2: the run screen gets ONE row per case; a set-up problem's second try is told on it, a FAILED case is never run again. */

function decisions() {
  const d = new Map<string, boolean>();
  return { allow: (id: string) => { d.set(id, true); }, keep: (id: string) => { d.set(id, false); }, allowed: (id: string) => d.get(id) === true };
}

const tc = (id: string): TestCase => ({
  id, title: 'testCase', retries: 1, annotations: [],
  parent: { project: () => ({ name: 'Case - one', metadata: { groups: ['Web'] } }) },
}) as unknown as TestCase;

const result = (status: string, retry: number, error = '', annotations: TestResult['annotations'] = []): TestResult =>
  ({ status, retry, duration: 5, errors: error ? [{ message: error }] : [], attachments: [], annotations }) as unknown as TestResult;

function reporter() {
  const lines: Array<Record<string, unknown>> = [];
  const r = new LiveReporter({ decisions: decisions(), print: (l: string) => { if (l.startsWith('@@live ')) lines.push(JSON.parse(l.slice(7))); } });
  return { r, lines, kinds: () => lines.map((l) => `${l.t}${l.status ? `:${l.status}` : ''}`) };
}

test('a set-up problem: one row - the note says it runs once more, the second try ends it', () => {
  const { r, lines, kinds } = reporter();
  const t = tc('a');
  r.onTestBegin(t, result('running', 0));
  r.onTestEnd(t, result('failed', 0, 'TypeError: fetch failed'));
  r.onTestBegin(t, result('running', 1));
  r.onTestEnd(t, result('passed', 1));
  expect(kinds()).toEqual(['test', 'note', 'end:pass']);
  expect(String(lines[1].text)).toContain('once more');
  expect(String(lines[2].msg)).toContain('second try');
});

test('a wrong result: FAILED at once, the kept first try leaves nothing more on the run screen', () => {
  const { r, kinds } = reporter();
  const t = tc('b');
  r.onTestBegin(t, result('running', 0));
  r.onTestEnd(t, result('failed', 0, 'Error: Approve · toast - expected "a", seen "b" ✗'));
  r.onTestBegin(t, result('running', 1));
  r.onTestEnd(t, result('skipped', 1));
  expect(kinds()).toEqual(['test', 'end:fail']);
});

test('a case skipped for a missing record is BLOCKED naming it', () => {
  const { r, lines } = reporter();
  const t = { ...tc('c'), annotations: [{ type: 'skip', description: 'Not tested - needs the employee made by this run' }] } as TestCase;
  r.onTestBegin(t, result('running', 0));
  r.onTestEnd(t, result('skipped', 0, '', [{ type: KIND_NOTE, description: 'data' }]));
  expect(lines[1]).toMatchObject({ t: 'end', status: 'blocked', msg: 'Not tested - needs the employee made by this run' });
});
