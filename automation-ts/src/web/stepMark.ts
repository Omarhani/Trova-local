import { Locator, Page } from '@playwright/test';

/** the actions done with the mouse at one point: their picture also marks where the click lands (the element's middle) */
const POINTED = new Set(['click', 'double-click', 'right-click', 'hold', 'hover', 'drag', 'switch-on', 'switch-off']);

/**
 * page code: Java's numbered step box (utils.MethodHandlesWebSteps.STEP_BOX_SCRIPT, same look) and, for a mouse step, a
 * round mark at the click point. An overlay only: fixed, on top, clicks pass through (pointer-events: none), the number
 * and the word are CSS content - the app's own elements, layout and texts are never touched.
 */
function draw(el: Element, a: { step: number; action: string; point: boolean }): void {
  const d = document;
  if (!d.getElementById('__trova_mark_style')) {
    const s = d.createElement('style');
    s.id = '__trova_mark_style';
    s.textContent = '.__trova_box{position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;'
      + 'border:3px solid #ff2d55;border-radius:6px;background:rgba(255,45,85,.12);box-shadow:0 0 0 4px rgba(255,45,85,.25)}'
      + '.__trova_box::before{content:attr(data-n);position:absolute;top:-18px;left:-18px;min-width:32px;height:32px;padding:0 8px;'
      + 'box-sizing:border-box;border-radius:16px;background:#ff2d55;color:#fff;font:bold 18px/32px Arial,sans-serif;text-align:center}'
      + '.__trova_box::after{content:attr(data-l);position:absolute;top:-15px;left:20px;padding:2px 8px;border-radius:4px;'
      + 'background:#1f2937;color:#fff;font:bold 15px/20px Arial,sans-serif;white-space:nowrap}'
      + '.__trova_point{position:fixed;z-index:2147483647;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;'
      + 'border-radius:50%;box-sizing:border-box;border:3px solid #fff;background:#ff2d55;box-shadow:0 0 0 3px #ff2d55,0 0 10px 4px rgba(0,0,0,.35)}';
    (d.head ?? d.documentElement).appendChild(s);
  }
  d.querySelectorAll('.__trova_box, .__trova_point').forEach((x) => x.remove());
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const box = d.createElement('div');
  box.className = '__trova_box';
  box.setAttribute('data-n', String(a.step));
  box.setAttribute('data-l', a.action);
  box.setAttribute('data-step', String(a.step));
  Object.assign(box.style, { left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
  d.documentElement.appendChild(box);
  // Omar 2026-11-11: the mark shows as the action starts and goes after 1 s - a picture after a page change never keeps it
  setTimeout(() => box.remove(), 1000);
  if (!a.point) return;
  const dot = d.createElement('div');
  dot.className = '__trova_point';
  dot.setAttribute('data-step', String(a.step));
  Object.assign(dot.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` });
  d.documentElement.appendChild(dot);
  setTimeout(() => dot.remove(), 1000);
}

/** marks the element the step acts on, for its picture; cosmetic - it never fails or slows a step (1 s at most) */
export async function markStep(found: Locator, step: number, action: string): Promise<void> {
  await found.evaluate(draw, { step, action, point: POINTED.has(action) }, { timeout: 1000 }).catch(() => undefined);
}

/** the marks of this step and older ones taken off the page (a newer step's mark stays) */
export async function clearMarks(page: Page, step: number): Promise<void> {
  await page.evaluate((upTo) => document.querySelectorAll('.__trova_box, .__trova_point')
    .forEach((x) => { if (Number(x.getAttribute('data-step')) <= upTo) x.remove(); }), step).catch(() => undefined);
}
