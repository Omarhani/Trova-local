import { Page } from '@playwright/test';
import { BasePage } from './base/BasePage';

/** The app's first page after sign-in - the TS twin of pages.HomePage; the project adds its own elements here. */
export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
}
