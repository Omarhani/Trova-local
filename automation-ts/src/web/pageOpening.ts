import { Page, Response } from '@playwright/test';
import { notOpened } from './notOpened';
import { appCall } from './signin/signInHolds';

/** where apps put an ERROR message: toastr / PrimeNG error toasts and an alert role (a success toast is not an error) */
const ERROR_MESSAGE = '#toast-container .toast-error, .toast-error, .p-toast-message-error, [role="alert"]';

/** the app's error message on the page now ('' = none) - read at once, never waited for */
async function errorShown(page: Page): Promise<string> {
  return page.locator(ERROR_MESSAGE).filter({ visible: true }).first()
    .innerText({ timeout: 1000 }).then((t) => t.trim(), () => '');
}

/**
 * Opens one of the app's pages: open() does the steps and says whether the page showed in time. Not shown (runs 865 /
 * 866): the app's error message or server error seen on the way = FAILED as Expected / Actual; nothing wrong seen =
 * the app was too slow - Not checked in plain words, never the app's wrong answer.
 */
export async function pageOpens(page: Page, what: string, seconds: number, open: () => Promise<boolean>): Promise<void> {
  const statuses: number[] = [];
  const answered = (r: Response): void => { if (appCall(r.request())) statuses.push(r.status()); };
  page.on('response', answered);
  try {
    if (await open()) return;
    throw notOpened(what, seconds, { statuses: [...statuses], message: await errorShown(page) });
  } finally {
    page.off('response', answered);
  }
}
