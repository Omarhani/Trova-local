import type { ConsoleMessage, Page } from '@playwright/test';
import { emit } from '../report/liveEvents';
import { currentStep } from '../report/stepNumbers';
import { TOAST } from './toastWatch';

/** what the page says on its console for each message it showed - read here, never shown as a console line */
const MARK = '@@trova-page-message ';
/** the same text from two boxes of one message (a toast and its alert) within this time is one message */
const SAME_MS = 1000;
const watched = new WeakSet<Page>();

/** one message the page showed: its text, the step it came after, when (epoch ms) */
export interface PageMessage {
  text: string;
  step: number;
  at: number;
}

/**
 * Omar 2026-11-12 (Test 8094 run 881): the app showed "plan added", our read looked in a wrong box and the toast was gone
 * before the last pictures, so first aid's look had no proof. Every message the page shows (toasts, snack bars, alerts -
 * the boxes of toastWatch) is told as it shows, with its step and time, on every page from its start: the run keeps it
 * with the case ("log", kind "message") and the look after a failed check reads it as proof. One watch per page.
 */
export async function watchPageMessages(page: Page, tell: (m: PageMessage) => void = tellRun, step: () => number = currentStep): Promise<void> {
  if (watched.has(page)) return;
  watched.add(page);
  page.on('console', (m: ConsoleMessage) => {
    const text = pageMessageOf(m.text());
    if (text !== undefined) tell({ text, step: step(), at: Date.now() });
  });
  const args = { selector: TOAST, mark: MARK, sameMs: SAME_MS };
  await page.addInitScript(sayMessages, args); // every page from its start
  await page.evaluate(sayMessages, args).catch(() => undefined); // the page already open
}

/** the message of one of our console lines, undefined for the page's own lines */
export function pageMessageOf(line: string): string | undefined {
  return line.startsWith(MARK) ? line.slice(MARK.length).trim() : undefined;
}

function tellRun(m: PageMessage): void {
  emit('log', { text: `The app showed a message: "${m.text}"`, kind: 'message', msg: m.text, step: m.step, at: m.at });
}

/** in the page: each message box that shows (or changes its text) is said once on the console with our mark */
function sayMessages(args: { selector: string; mark: string; sameMs: number }): void {
  const w = window as unknown as { __trovaMessageWatch?: boolean };
  if (w.__trovaMessageWatch) return;
  w.__trovaMessageWatch = true;
  const told = new WeakMap<Element, string>();
  const recent = new Map<string, number>();
  const say = (el: Element): void => {
    const text = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || told.get(el) === text) return;
    told.set(el, text);
    if (Date.now() - (recent.get(text) ?? 0) < args.sameMs) return;
    recent.set(text, Date.now());
    console.debug(args.mark + text.slice(0, 500));
  };
  const look = (node: Node | null): void => {
    if (!(node instanceof Element)) return;
    const box = node.closest(args.selector);
    if (box) say(box);
    node.querySelectorAll(args.selector).forEach(say);
  };
  new MutationObserver((changes) => changes.forEach((c) => {
    c.addedNodes.forEach(look);
    look(c.target instanceof Element ? c.target : c.target.parentElement);
  })).observe(document, { childList: true, subtree: true, characterData: true });
  look(document.documentElement);
}
