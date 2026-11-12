import { openWithOneRetry } from '../../pageOpen';
import { WebForms } from '../../webForms';

/**
 * Parent of every web page object: the web helpers (waits, clicks, mouse, typing, lists, browser messages, uploads, step
 * log) - the TS twin of pages.base.BasePage over utils.MethodHandlesWeb.
 */
export abstract class BasePage extends WebForms {
  /** opens an address of the app; a hung load is stopped and loaded once more */
  protected async open(url: string): Promise<void> {
    this.say('open', url, '');
    await openWithOneRetry(this.page, url);
    this.picture();
  }
}
