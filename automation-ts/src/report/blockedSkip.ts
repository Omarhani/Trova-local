import type { TestInfo } from '@playwright/test';
import { Kind, KIND_NOTE } from './failureKind';

/**
 * Round 2: a case that cannot run fairly (its login's sign-in ended or was refused, a record it needs is missing, the
 * run's pre-run check stopped its side) is skipped with its reason AND its kind - the run screen shows it BLOCKED.
 */
export function blockedSkip(testInfo: TestInfo, kind: Exclude<Kind, 'failed'>, reason: string): void {
  testInfo.annotations.push({ type: KIND_NOTE, description: kind });
  testInfo.skip(true, reason);
}
