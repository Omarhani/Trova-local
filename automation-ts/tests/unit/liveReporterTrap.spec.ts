import { expect, test } from '@playwright/test';
import type { TestCase, TestResult } from '@playwright/test/reporter';
import LiveReporter from '../../src/report/liveReporter';

/**
 * Omar 2026-11-12 (Test 8094 run 881): a block whose suite or block parameter says trap=true is a trap - the "test"
 * event says so (trap: true), so Trova never gives it a look, AI help or a treatment. Any other block: no field at all.
 */

const tc = (params: Record<string, string> | undefined): TestCase => ({
  id: 'x', title: 'checkPlanName', retries: 0, annotations: [],
  parent: { project: () => ({ name: 'Case - plan', metadata: { groups: ['Web'], params } }) },
}) as unknown as TestCase;

const running = { status: 'running', retry: 0, duration: 0, errors: [], attachments: [], annotations: [] } as unknown as TestResult;

function started(params: Record<string, string> | undefined): Record<string, unknown> {
  const lines: Array<Record<string, unknown>> = [];
  const r = new LiveReporter({ print: (l: string) => { if (l.startsWith('@@live ')) lines.push(JSON.parse(l.slice(7))); } });
  r.onTestBegin(tc(params), running);
  return lines[0];
}

test('a block whose parameter says trap=true is told as a trap', () => {
  expect(started({ trap: 'true' }).trap).toBe(true);
});

test('trap is read in any case of letters (TRUE, True)', () => {
  expect(started({ trap: 'TRUE' }).trap).toBe(true);
});

test('a block with trap=false or no trap parameter has no trap field', () => {
  expect(started({ trap: 'false' })).not.toHaveProperty('trap');
  expect(started({})).not.toHaveProperty('trap');
  expect(started(undefined)).not.toHaveProperty('trap');
});
