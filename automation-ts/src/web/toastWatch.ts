import type { Page } from '@playwright/test';

/** where apps put a short message: toastr, Angular Material / PrimeNG snack bars and toasts, an alert role */
export const TOAST = '#toast-container .toast-message, #toast-container .toast-title, .toast-message, mat-snack-bar-container, .p-toast-message-text, [role="alert"]';

/**
 * Omar 2026-11-11 (run 860): the app's message showed after Log in, but Trova read "no message" - a toast can come and go
 * between two looks. The watch starts BEFORE the action: every message the page shows from then on is kept in the page,
 * and the reader gives the first one (waiting up to seconds), "" when none showed. A new page (navigation) starts empty.
 */
export async function watchToasts(page: Page): Promise<(seconds: number) => Promise<string>> {
  await page.evaluate((selector) => {
    const w = window as unknown as { __trovaToasts?: string[]; __trovaToastWatch?: MutationObserver };
    w.__trovaToasts = [];
    w.__trovaToastWatch?.disconnect();
    const keep = (el: Element): void => {
      const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim() || '';
      if (text && !w.__trovaToasts!.includes(text)) w.__trovaToasts!.push(text);
    };
    const look = (node: Node): void => {
      if (!(node instanceof Element)) return;
      if (node.matches(selector)) keep(node);
      node.querySelectorAll(selector).forEach(keep);
    };
    w.__trovaToastWatch = new MutationObserver((changes) => changes.forEach((c) => {
      c.addedNodes.forEach(look);
      if (c.type === 'characterData' || c.type === 'childList') look(c.target instanceof Element ? c.target : c.target.parentElement as Node);
    }));
    w.__trovaToastWatch.observe(document.body, { childList: true, subtree: true, characterData: true });
  }, TOAST);
  return async (seconds: number): Promise<string> => page
    .waitForFunction(() => (window as unknown as { __trovaToasts?: string[] }).__trovaToasts?.[0] ?? '', undefined,
      { timeout: seconds * 1000, polling: 200 })
    .then((first) => first.jsonValue() as Promise<string>)
    .catch(() => '');
}
