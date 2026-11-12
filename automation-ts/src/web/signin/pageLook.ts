import { Page } from '@playwright/test';

/** page code: what looks unstyled now (empty = looks fine) - the same look as agent-tools' trova-page-look.js */
const LOOK = String.raw`(() => {
  const seen = [];
  const clear = (c) => !c || c === 'transparent' || /^rgba\(0, 0, 0, 0\)$/.test(c);
  const plain = new Set(['rgb(0, 0, 0)', 'rgb(0, 0, 238)', 'rgb(85, 26, 139)']);
  if (!document.styleSheets.length && !document.querySelector('[style]')) seen.push('no styles are loaded on the page');
  const menus = [...document.querySelectorAll('nav, aside, [role=navigation], [class*=sidebar i], [class*=side-menu i], [class*=sidenav i], [class*=menu i]')]
    .filter((m) => m.getBoundingClientRect().height > 100 && m.querySelectorAll('a, li, button').length >= 3);
  const menu = menus.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  if (menu) {
    const items = [...menu.querySelectorAll('a, li, button')].slice(0, 80);
    let backs = 0; const colours = new Set();
    for (const e of items) { const s = getComputedStyle(e); if (!clear(s.backgroundColor) || s.backgroundImage !== 'none') backs++; colours.add(s.color); }
    if (!backs && (colours.size <= 1 || [...colours].every((c) => plain.has(c)))) seen.push('the side menu has no colours and no item looks picked');
  }
  const used = new Set();
  for (const sheet of [...document.styleSheets]) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of [...(rules || [])].slice(0, 4000)) for (const m of (r.cssText || '').matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
  }
  const root = getComputedStyle(document.documentElement), body = document.body ? getComputedStyle(document.body) : root;
  const names = [...used].slice(0, 300);
  const empty = names.filter((n) => !root.getPropertyValue(n).trim() && !body.getPropertyValue(n).trim()).length;
  if (names.length >= 3 && empty / names.length >= 0.8) seen.push("the app's colour settings are empty");
  return seen;
})()`;

/**
 * A quick look right after signing in - the TS twin of utils.PageLook (Omar 2026-10-27): a page that opens signed in
 * but unstyled usually means a page setting the sign-in page writes first (theme, language ...) is missing.
 */
export async function pageLooksUnstyled(page: Page): Promise<string[]> {
  const seen = await page.evaluate(LOOK).catch(() => []);
  return Array.isArray(seen) ? seen.map(String) : [];
}

/** says so in the run's log when the signed-in page looks unstyled; a look only - never stops the run */
export async function noteLook(page: Page): Promise<void> {
  const seen = await pageLooksUnstyled(page);
  if (seen.length) {
    console.log(`Note: the page looks unstyled after signing in (${seen.join('; ')}). A page setting the sign-in page writes first (theme, language ...) may be missing from the sign-in.`);
  }
}
