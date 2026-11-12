import type { Page } from '@playwright/test';
import { withoutClose } from './uiText';

/** how often the check looks again while it waits for the action's message */
const LOOK_MS = 200;

const shown = new WeakMap<Page, { text: string; at: number }[]>();
const actedAt = new WeakMap<Page, number>();

/** the page showed a message (pageMessages tells it as it shows - a toast that comes and goes is kept here) */
export function messageShown(page: Page, text: string, at: number = Date.now()): void {
  const list = shown.get(page) ?? [];
  list.push({ text: withoutClose(text), at });
  shown.set(page, list.slice(-50));
}

/** an action (a click) on the page starts now - the message it brings is one shown from now on */
export function actionStarts(page: Page, at: number = Date.now()): void {
  actedAt.set(page, at);
}

/** the messages the page showed since its last action, oldest first */
export function shownSinceAction(page: Page): string[] {
  const since = actedAt.get(page) ?? 0;
  return (shown.get(page) ?? []).filter((m) => m.at >= since).map((m) => m.text);
}

/**
 * Run 994 (case 4182): the app's success toast showed after Save and went before the check looked - the check read "".
 * The action's message: the first one shown since the click that is the one wanted (isIt), or one the message box shows
 * now (readNow - a page without the watch); waited up to seconds. None of them: the last message shown since the click,
 * else what the box shows, else "" - so a wrong expected message still fails with what the app really said.
 */
export async function messageAfterAction(page: Page, isIt: (text: string) => boolean, seconds: number,
                                         readNow: () => Promise<string>): Promise<string> {
  const until = Date.now() + seconds * 1000;
  let now = '';
  for (;;) {
    const found = shownSinceAction(page).find(isIt);
    if (found !== undefined) return found;
    now = withoutClose(await readNow().catch(() => ''));
    if (now && isIt(now)) return now;
    if (Date.now() >= until) break;
    await page.waitForTimeout(LOOK_MS);
  }
  return shownSinceAction(page).at(-1) ?? now;
}
