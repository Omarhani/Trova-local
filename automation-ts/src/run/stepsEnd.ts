import type { TestInfo } from '@playwright/test';

type Finished = { _onDidFinishTestFunctions?: Array<() => Promise<void>> };

/**
 * Round 2 review: run fn right after the test's own steps, before its afterEach clean-up (Playwright 1.56 keeps that
 * list on the test's info; when a later Playwright has none, fn is not called and the fixture's end counts instead).
 */
export function onStepsEnd(testInfo: TestInfo, fn: () => void): void {
  const list = (testInfo as unknown as Finished)._onDidFinishTestFunctions;
  if (Array.isArray(list)) list.push(async () => fn());
}
