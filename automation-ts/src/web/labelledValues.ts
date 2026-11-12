import { Page } from '@playwright/test';
import { settle } from './covers';

/** runs in the browser: the value next to a shown label (either language), "" when none - utils.LabelledValues.byLabel */
function valueByLabel(labels: string[]): string {
  const want = labels.map((w) => w.trim().toLowerCase());
  const txt = (e: Element | null): string => ((e as HTMLElement | null)?.innerText || e?.textContent || '').replace(/\s+/g, ' ').trim();
  for (const e of Array.from(document.querySelectorAll('label, dt, th, span, div, p, strong, b, td'))) {
    const t = txt(e).replace(/[:：]\s*$/, '').toLowerCase();
    if (want.indexOf(t) < 0 || (e as HTMLElement).offsetParent === null) continue;
    const id = e.getAttribute('for');
    const field = id ? document.getElementById(id) : null;
    if (field) return (field as HTMLInputElement).value || txt(field);
    if (txt(e.nextElementSibling)) return txt(e.nextElementSibling);
    const p = e.parentElement;
    if (p && txt(p.nextElementSibling)) return txt(p.nextElementSibling);
    const rest = p ? txt(p).replace(txt(e), '').replace(/^[:：\s]+/, '').trim() : '';
    if (rest) return rest;
  }
  return '';
}

/**
 * A value on a details view read by its LABEL, never by its position - the TS twin of utils.LabelledValues.byLabel:
 * the page settles first, then the value is looked for up to seconds; "" when the label is not on the screen.
 */
export async function byLabel(page: Page, seconds: number, ...labels: string[]): Promise<string> {
  await settle(page, 20_000);
  const until = Date.now() + Math.max(1, seconds) * 1000;
  let last = '';
  do {
    last = await page.evaluate(valueByLabel, labels).catch(() => '');
    if (last.trim() !== '') return last;
    await page.waitForTimeout(250);
  } while (Date.now() < until);
  return last;
}
