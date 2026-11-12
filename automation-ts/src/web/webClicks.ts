import { Locator } from '@playwright/test';
import { doneOrMessage } from './browserMessages';
import { WebActions } from './webActions';

/**
 * Double click, right click, click and hold, hover, drag and drop, scroll inside a modal and submit - the TS twin of
 * utils.MethodHandlesWebClicks. Each waits for its element (plain words when it does not show), scrolls it into view,
 * acts, and says the step with the action it did. Playwright finds the element fresh on every try (no stale retries).
 */
export class WebClicks extends WebActions {
  protected async doubleClick(selector: string, seconds: number, element = selector): Promise<void> {
    const found = await this.ready(selector, seconds, element);
    this.say('double-click', element, selector);
    await this.markFound(found, 'double-click');
    await this.guarded(() => doneOrMessage(this.page, found.dblclick({ timeout: seconds * 1000 })));
    this.picture();
  }

  /** the context (right) click */
  protected async rightClick(selector: string, seconds: number, element = selector): Promise<void> {
    const found = await this.ready(selector, seconds, element);
    this.say('right-click', element, selector);
    await this.markFound(found, 'right-click');
    await this.guarded(() => doneOrMessage(this.page, found.click({ button: 'right', timeout: seconds * 1000 })));
    this.picture();
  }

  /** presses the mouse on the element and keeps it down until release() */
  protected async clickAndHold(selector: string, seconds: number, element = selector): Promise<void> {
    const found = await this.ready(selector, seconds, element);
    this.say('hold', element, selector);
    await this.markFound(found, 'hold');
    await this.guarded(() => found.hover({ timeout: seconds * 1000 }));
    await this.page.mouse.down();
    this.picture();
  }

  /** lets the mouse button go where the mouse is */
  protected async release(): Promise<void> {
    this.say('release', 'mouse', '');
    await this.page.mouse.up();
    this.picture();
  }

  /** moves the mouse over the element (opens its menu or tip) */
  protected async hover(selector: string, seconds: number, element = selector): Promise<void> {
    const found = await this.ready(selector, seconds, element);
    this.say('hover', element, selector);
    await this.markFound(found, 'hover');
    await this.guarded(() => found.hover({ timeout: seconds * 1000 }));
    this.picture();
  }

  protected async dragAndDrop(from: string, to: string, seconds: number, element = from, target = to): Promise<void> {
    const source = await this.ready(from, seconds, element);
    const place = await this.ready(to, seconds, target);
    this.say('drag', `${element} to ${target}`, from);
    await this.markFound(source, 'drag');
    await this.guarded(() => source.dragTo(place, { timeout: seconds * 1000 }));
    this.picture();
  }

  /** scrolls the inner box (a modal, a side panel) so the element sits in its middle, not the page */
  protected async scrollToElementInModal(selector: string, seconds: number, element = selector): Promise<void> {
    const found = this.at(selector);
    await this.guarded(() => found.waitFor({ state: 'attached', timeout: seconds * 1000 })).catch((e: unknown) => {
      throw new Error(`${element} was not on the page within ${seconds} s`, { cause: e });
    });
    this.say('scroll', element, selector);
    await found.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
    await this.markFound(found, 'scroll');
    this.picture();
  }

  /** sends the form the field (or the form itself) belongs to */
  protected async submit(selector: string, seconds: number, element = selector): Promise<void> {
    const found = await this.ready(selector, seconds, element);
    this.say('submit', element, selector);
    await this.markFound(found, 'submit');
    const sent = await found.evaluate((e) => {
      const form = e instanceof HTMLFormElement ? e : (e as HTMLInputElement).form ?? e.closest('form');
      if (!form) return false;
      form.requestSubmit();
      return true;
    });
    if (!sent) throw new Error(`${element} is not in a form - there is nothing to send`);
    this.picture();
  }

  /** presses Escape on the page (closes a menu or a dialog) */
  protected async pressEscape(): Promise<void> {
    this.say('press', 'Escape', '');
    await this.page.keyboard.press('Escape');
    this.picture();
  }

  /** shown and scrolled into view */
  private async ready(selector: string, seconds: number, element: string): Promise<Locator> {
    const found = await this.shown(selector, seconds, element);
    await found.scrollIntoViewIfNeeded({ timeout: seconds * 1000 }).catch(() => undefined);
    return found;
  }
}
