import { test } from '@playwright/test';

/** where a step got stuck: the page or screen step (LeavesPage.save) and the test it belongs to */
export interface StuckAt {
  step: string;
  test: string;
}

/** the step that got stuck: the first frame outside the framework's helpers (notOurs) - "LeavesPage.save" */
export function stuckWhere(stack: string | undefined, notOurs: RegExp): string {
  for (const line of (stack ?? '').split('\n').slice(1)) {
    if (notOurs.test(line)) continue;
    const m = /^\s*at (?:async )?([\w$.]+) \(/.exec(line);
    if (m) return m[1].replace(/^Object\./, '');
  }
  return 'a step';
}

/** the running test's title ('' outside a test) */
export function testTitle(): string {
  try {
    return test.info().title;
  } catch {
    return '';
  }
}
