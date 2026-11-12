import { Page } from '@playwright/test';
import { testData } from '../run/testData';

/** opens a page of the portal by its path ("/leaves") on the environment's web address; the app keeps the run's sign-in */
export async function openPortalPath(page: Page, path: string): Promise<void> {
  await page.goto(testData.webUrl().replace(/\/+$/, '') + path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}
