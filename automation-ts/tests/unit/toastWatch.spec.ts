import { expect, test } from '@playwright/test';
import { watchToasts } from '../../src/web/toastWatch';

test.use({ channel: 'chrome', headless: true }); // this computer's own Chrome, as the runs use

/** Omar 2026-11-11 (run 860): the app's message showed after Log in, but Trova read "no message" - a short toast is caught */
test('a toast that shows for a moment and goes is still read, when the watch started before the click', async ({ page }) => {
  await page.setContent(`<button id="b">Log in</button><script>
    document.getElementById('b').onclick = () => setTimeout(() => {
      const c = document.createElement('div'); c.id = 'toast-container';
      c.innerHTML = '<div class="toast toast-error"><div class="toast-message">البيانات المدخلة غير صحيحة</div></div>';
      document.body.appendChild(c); setTimeout(() => c.remove(), 300);
    }, 200);</script>`);
  const seen = await watchToasts(page);
  await page.click('#b');
  await page.waitForTimeout(800); // the toast came and went before anyone looked
  expect(await seen(5)).toBe('البيانات المدخلة غير صحيحة');
});

test('no toast at all reads "" after the wait', async ({ page }) => {
  await page.setContent('<button id="b">Log in</button>');
  const seen = await watchToasts(page);
  await page.click('#b');
  expect(await seen(1)).toBe('');
});

test('a message box the app shows another way (role alert) is read too', async ({ page }) => {
  await page.setContent(`<button id="b">x</button><script>document.getElementById('b').onclick = () => {
    const a = document.createElement('div'); a.setAttribute('role', 'alert'); a.textContent = 'Wrong Account Code'; document.body.appendChild(a); };</script>`);
  const seen = await watchToasts(page);
  await page.click('#b');
  expect(await seen(3)).toBe('Wrong Account Code');
});
