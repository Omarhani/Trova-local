import { expect, test } from '@playwright/test';
import { PageMessage, pageMessageOf, watchPageMessages } from '../../src/web/pageMessages';

test.use({ channel: 'chrome', headless: true }); // this computer's own Chrome, as the runs use

/**
 * Omar 2026-11-12 (Test 8094 run 881): the app showed "plan added", our read looked in a wrong box, and the toast was gone
 * before the last pictures - the look had no proof. Every message the page shows during the case is told as it shows
 * (text, step, time), from the first page on and after every page change, so the look can use it as proof.
 */

const SHOW_AND_GO = (text: string) => `<button id="b">Save</button><script>
  document.getElementById('b').onclick = () => setTimeout(() => {
    const c = document.createElement('div'); c.id = 'toast-container';
    c.innerHTML = '<div class="toast"><div class="toast-message">${text}</div></div>';
    document.body.appendChild(c); setTimeout(() => c.remove(), 300);
  }, 100);</script>`;

async function told(seen: PageMessage[], count: number): Promise<void> {
  await expect.poll(() => seen.length, { timeout: 5000 }).toBeGreaterThanOrEqual(count);
}

test('a toast that shows for a moment and goes is told with its text and the step it came after', async ({ page }) => {
  const seen: PageMessage[] = [];
  await watchPageMessages(page, (m) => seen.push(m), () => 7);
  await page.setContent(SHOW_AND_GO('تم إضافة خطة عمل بنجاح'));
  await page.click('#b');
  await told(seen, 1);
  expect(seen[0].text).toBe('تم إضافة خطة عمل بنجاح');
  expect(seen[0].step).toBe(7);
  expect(seen[0].at).toBeGreaterThan(0);
});

test('a message on the next page (after the page changed) is told too', async ({ page }) => {
  const seen: PageMessage[] = [];
  await watchPageMessages(page, (m) => seen.push(m), () => 3);
  await page.goto(`data:text/html,${encodeURIComponent('<div role="alert">Saved on page two</div>')}`);
  await told(seen, 1);
  expect(seen.map((m) => m.text)).toContain('Saved on page two');
});

test('the same message box is told once, not on every change inside it', async ({ page }) => {
  const seen: PageMessage[] = [];
  await watchPageMessages(page, (m) => seen.push(m), () => 1);
  await page.setContent('<div id="x"></div>');
  await page.evaluate(() => {
    const a = document.createElement('div'); a.setAttribute('role', 'alert'); a.textContent = 'Plan added';
    document.body.appendChild(a); a.setAttribute('data-x', '1'); a.appendChild(document.createTextNode(''));
  });
  await told(seen, 1);
  await page.waitForTimeout(300);
  expect(seen.filter((m) => m.text === 'Plan added')).toHaveLength(1);
});

test('watching a page twice tells each message once', async ({ page }) => {
  const seen: PageMessage[] = [];
  await watchPageMessages(page, (m) => seen.push(m), () => 1);
  await watchPageMessages(page, (m) => seen.push(m), () => 1);
  await page.setContent(SHOW_AND_GO('Once only'));
  await page.click('#b');
  await told(seen, 1);
  await page.waitForTimeout(300);
  expect(seen).toHaveLength(1);
});

test('the page\'s own console lines are not messages; our mark is', () => {
  expect(pageMessageOf('POST /api/login 401')).toBeUndefined();
  expect(pageMessageOf('@@trova-page-message Plan added')).toBe('Plan added');
});
