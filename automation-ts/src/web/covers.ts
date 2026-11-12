import { Page } from '@playwright/test';

/** loading layers of the common UI kits - only while shown (utils.Covers.KNOWN) */
export const COVERS = [
  '.ngx-spinner-overlay', 'ngx-spinner .overlay', '.loading-overlay', '.loader-overlay', '.page-loader', '.blockUI.blockOverlay',
  '.k-loading-mask', '.ant-spin-spinning', '.el-loading-mask', '.v-overlay--active .v-progress-circular', 'mat-progress-spinner',
  'mat-spinner', '.MuiCircularProgress-root', "[aria-busy='true'].overlay",
].join(', ');

/**
 * The page has settled the way the Java helpers wait for it (utils.PageReady.await): its document is loaded and no
 * loading layer covers it - never "no network for 500 ms", which an app that keeps asking its server never reaches
 * (Test 8094 runs 592 vs 584: up to 10 s lost per wait). At most `ms`; never fails.
 */
export async function settle(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  await page.waitForLoadState('load', { timeout: ms }).catch(() => undefined);
  while (Date.now() < until) {
    if (!(await coveredNow(page))) return;
    await page.waitForTimeout(150);
  }
}

/**
 * a loading layer covers the page now - one that can be seen: Test 8094 run 684, the movements page keeps its
 * .ngx-spinner-overlay in the page at opacity 0 when idle (Java's invisibility check counts that as gone; Playwright's
 * isVisible does not look at opacity, so the page looked covered forever)
 */
export async function coveredNow(page: Page): Promise<boolean> {
  return page.locator(COVERS).evaluateAll((els) => els.some((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    }
    return true;
  })).catch(() => false);
}
