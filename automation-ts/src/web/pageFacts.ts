import { Page } from '@playwright/test';

/**
 * Plain facts about the page when a web test fails (Test 8094 run 574: a menu link was not found and nobody could see
 * why): the address and the menu texts the page shows - never a value typed, never a stored key.
 */
export function factsLine(url: string, menu: string[]): string {
  const address = url.split('?')[0];
  const names = [...new Set(menu.map((m) => m.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const line = `Page at the failure: ${address} - menu: ${names.join(' | ')}`;
  return line.length > 600 ? `${line.slice(0, 597)}...` : line;
}

/** the app sent the browser to its sign-in page: it did not open signed in */
export function onSignInPage(url: string): boolean {
  return /(log-?in|sign-?in|auth)(\b|\/|$)/i.test(new URL(url).pathname + new URL(url).hash);
}

/** the app shows its sign-in page or a page that says this login has no right to it (/401, /403, unauthorized) */
export function refusedPage(url: string): boolean {
  const where = new URL(url).pathname + new URL(url).hash;
  return onSignInPage(url) || /(^|[/#])(401|403|unauthori[sz]ed|forbidden|access-denied)(\/|$|\?)/i.test(where);
}

/** the visible link and menu texts of the page (max 60) */
export async function menuTexts(page: Page): Promise<string[]> {
  return page.locator('a:visible, [role="menuitem"]:visible, nav button:visible')
    .evaluateAll((els) => els.slice(0, 60).map((e) => (e as HTMLElement).innerText || e.getAttribute('aria-label') || ''))
    .catch(() => []);
}
