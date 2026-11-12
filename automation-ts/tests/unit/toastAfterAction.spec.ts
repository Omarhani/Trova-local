import { expect, Page, test } from '@playwright/test';
import { watchPageMessages } from '../../src/web/pageMessages';
import { LeavesPage } from '../../src/web/pages/LeavesPage';
import { RegistrationRequestsPage } from '../../src/web/pages/RegistrationRequestsPage';
import { RegistrationReviewPage } from '../../src/web/pages/RegistrationReviewPage';
import { WorkPlansPage } from '../../src/web/pages/WorkPlansPage';

test.use({ channel: 'chrome', headless: true }); // this computer's own Chrome, as the runs use

/**
 * Omar 2026-11-12 (Test 8094 run 994, case 4182): the app showed "تمت إضافة المغادرة بنجاح" after Save (Trova's own log
 * kept it), but the toast check read "" - it came and went between two looks. Every toast check reads the messages the
 * page showed from the click on, so one that came and went still counts; a wrong expected message still fails.
 */
const ADDED = 'تمت إضافة المغادرة بنجاح';

/** Save shows a toast (role alert, as the portal's toastr) for a moment after a short wait, then removes it */
const SHOW_AND_GO = (text: string, showMs = 300) => `<button id="b">Save</button><script>
  document.getElementById('b').onclick = () => setTimeout(() => {
    const c = document.createElement('div'); c.id = 'toast-container';
    c.innerHTML = '<div class="toast"><div class="toast-message" role="alert">${text}</div></div>';
    document.body.appendChild(c); setTimeout(() => c.remove(), ${showMs});
  }, 100);</script>`;

type Reads = { save(): Promise<void>; read(expected: string, seconds: number): Promise<string> };

/** each page object with a toast check, clicking Save the way its own steps click */
const PAGES: Record<string, (page: Page) => Reads> = {
  LeavesPage: (page) => new (class extends LeavesPage {
    save = () => this.click('#b', 5, 'Save');
    read = (e: string, s: number) => this.toastShows(e, s);
  })(page),
  WorkPlansPage: (page) => new (class extends WorkPlansPage {
    save = () => this.click('#b', 5, 'Save');
    read = (e: string, s: number) => this.toastShows(e, s);
  })(page),
  RegistrationReviewPage: (page) => new (class extends RegistrationReviewPage {
    save = () => this.click('#b', 5, 'Save');
    read = (e: string, s: number) => this.toastShows(e, s);
  })(page),
  RegistrationRequestsPage: (page) => new (class extends RegistrationRequestsPage {
    save = () => this.click('#b', 5, 'Save');
    read = (_e: string, s: number) => this.toastText(s);
  })(page),
};

async function ready(page: Page, html: string): Promise<void> {
  await watchPageMessages(page, () => undefined, () => 1); // as every run page has (sharedBrowser)
  await page.setContent(html);
}

for (const [name, make] of Object.entries(PAGES)) {
  test(`${name}: a success toast that came and went before the check is still read, from the click`, async ({ page }) => {
    await ready(page, SHOW_AND_GO(ADDED));
    const p = make(page);
    await p.save();
    await page.waitForTimeout(1000); // the page was slow to look: the toast came and went before the check
    expect(await p.read(ADDED, 3)).toBe(ADDED);
  });

  test(`${name}: trap - a wrong expected message is not passed; the check sees what the app really said`, async ({ page }) => {
    await ready(page, SHOW_AND_GO(ADDED));
    const p = make(page);
    await p.save();
    await page.waitForTimeout(1000);
    const seen = await p.read('تم الحذف بنجاح', 1);
    expect(seen).not.toBe('تم الحذف بنجاح');
    expect(seen).toBe(ADDED);
  });
}

test('a message shown before the click (an earlier action) is not this action\'s message', async ({ page }) => {
  await ready(page, `${SHOW_AND_GO(ADDED, 200)}<button id="quiet">Quiet</button>`);
  const p = new (class extends LeavesPage {
    save = () => this.click('#b', 5, 'Save');
    quiet = () => this.click('#quiet', 5, 'Quiet');
  })(page);
  await p.save();
  await page.waitForTimeout(800); // the earlier toast came and went
  await p.quiet(); // this action shows no message
  expect(await p.toastShows(ADDED, 1)).toBe('');
});

test('no message at all reads "" after the wait', async ({ page }) => {
  await ready(page, '<button id="b">Save</button>');
  const p = new (class extends LeavesPage {
    save = () => this.click('#b', 5, 'Save');
  })(page);
  await p.save();
  expect(await p.toastShows(ADDED, 1)).toBe('');
});
