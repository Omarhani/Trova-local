import type { TestResult } from '@playwright/test/reporter';
import { maskLogText } from './logMask';
import { keepWithRun } from './runReportFolder';

/** the names the test bases attach a failure's facts and last screen under */
export const FACTS = 'failure facts';
export const LAST_SCREEN = 'last screen';

/**
 * Test 8094 run 585: what a test process prints after its end never reached the run - so the reporter (the process the
 * runner reads) says a failure's facts in the run's console and keeps its last screen with the run's report.
 */
export function sayFailureFacts(title: string, result: TestResult, print: (line: string) => void): void {
  for (const a of result.attachments) {
    if (a.name === FACTS && a.body) print(maskLogText(a.body.toString('utf8'))); // Round 2: never a token in the run's console
    if (a.name === LAST_SCREEN && a.body) keepWithRun(title, a.body);
  }
}
