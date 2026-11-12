import { expect, test } from '@playwright/test';
import type { TestResult } from '@playwright/test/reporter';
import { FACTS, LAST_SCREEN, sayFailureFacts } from '../../src/report/failureFacts';

/** Test 8094 run 585: a failure's facts are said by the reporter (the process the runner reads), not by the test process. */
test('the facts attachment is printed for the run console', () => {
  const lines: string[] = [];
  const result = { attachments: [{ name: FACTS, contentType: 'text/plain', body: Buffer.from('Phone screen at the failure: Next') },
    { name: LAST_SCREEN, contentType: 'image/png', body: Buffer.from('png') }] } as unknown as TestResult;
  delete process.env.TROVA_RUN_ID; // outside a Trova run no file is written
  sayFailureFacts('t', result, (l) => lines.push(l));
  expect(lines).toEqual(['Phone screen at the failure: Next']);
});

test('a passed test says nothing', () => {
  const lines: string[] = [];
  sayFailureFacts('t', { attachments: [] } as unknown as TestResult, (l) => lines.push(l));
  expect(lines).toEqual([]);
});
