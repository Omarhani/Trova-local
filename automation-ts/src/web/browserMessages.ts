import { Dialog, Page } from '@playwright/test';

/** how long a browser message nobody takes stays open before it is closed (an unexpected one never blocks the page) */
const UNTAKEN_MS = 15_000;

interface Held {
  dialog: Dialog;
  timer: NodeJS.Timeout;
}

const held = new WeakMap<Page, Held[]>();

/**
 * Keeps the page's browser messages (alert, confirm, question) open until a test answers them, as Selenium does -
 * Playwright closes them at once when nobody listens. One watch per page; one nobody takes is closed after 15 s.
 */
export function watchBrowserMessages(page: Page): void {
  if (held.has(page)) return;
  const queue: Held[] = [];
  held.set(page, queue);
  page.on('dialog', (dialog) => {
    const entry: Held = { dialog, timer: setTimeout(() => {
      queue.splice(queue.indexOf(entry), 1);
      dialog.dismiss().catch(() => undefined);
    }, UNTAKEN_MS) };
    entry.timer.unref?.();
    queue.push(entry);
  });
}

/** the oldest open browser message once one shows (within seconds); take = it leaves the queue to be answered */
export async function browserMessage(page: Page, seconds: number, take: boolean): Promise<Dialog> {
  const queue = held.get(page) ?? [];
  const until = Date.now() + seconds * 1000;
  while (queue.length === 0) {
    if (Date.now() >= until) throw new Error(`No browser message showed within ${seconds} s`);
    await new Promise((r) => setTimeout(r, 100));
  }
  const first = queue[0];
  if (take) {
    clearTimeout(first.timer);
    queue.shift();
  }
  return first.dialog;
}

/**
 * Playwright holds an action that opened a browser message until the message is answered; Selenium's click returns. So
 * an action on a watched page is done as soon as a new message shows - the test then accepts or dismisses it.
 */
export async function doneOrMessage(page: Page, action: Promise<unknown>): Promise<void> {
  const queue = held.get(page);
  if (!queue) {
    await action;
    return;
  }
  const before = queue.length;
  let settled = false;
  const acting = action.finally(() => { settled = true; });
  while (!settled) {
    if (queue.length > before) {
      acting.catch(() => undefined); // it ends when the message is answered
      return;
    }
    await Promise.race([acting.catch(() => undefined), new Promise((r) => setTimeout(r, 50))]);
  }
  await acting;
}
