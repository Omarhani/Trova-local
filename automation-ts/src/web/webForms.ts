import { Page } from '@playwright/test';
import { typedValue } from '../report/typedValue';
import { passwordBox } from './ownBox';
import { attachmentPath } from './attachments';
import { browserMessage, watchBrowserMessages } from './browserMessages';
import { WebClicks } from './webClicks';

/** the wait for a field when the step names none (utils.WaitedReads.DEFAULT_SECONDS) */
const DEFAULT_SECONDS = 15;

/**
 * Lists (native select) by text, value or place; browser messages (accept, dismiss, answer, read); uploads from Test
 * Data > Attachments; slow typing - the TS twin of utils.MethodHandlesWebForms. Failures in plain words.
 */
export class WebForms extends WebClicks {
  constructor(page: Page) {
    super(page);
    watchBrowserMessages(page);
  }

  protected async selectByText(selector: string, text: string, seconds: number, element = selector): Promise<void> {
    await this.choose(selector, seconds, element, (o) => o.label.trim() === text.trim(), `no option "${text}"`, { label: text });
  }

  protected async selectByValue(selector: string, value: string, seconds: number, element = selector): Promise<void> {
    await this.choose(selector, seconds, element, (o) => o.value === value, `no option with the value "${value}"`, { value });
  }

  /** index from 0, as Java's selectByIndex */
  protected async selectByIndex(selector: string, index: number, seconds: number, element = selector): Promise<void> {
    await this.choose(selector, seconds, element, (o) => o.index === index, `no option number ${index + 1}`, { index });
  }

  protected async acceptAlert(seconds: number): Promise<void> {
    const message = await browserMessage(this.page, seconds, true);
    this.say('accept-alert', message.message(), '');
    await message.accept();
    this.picture();
  }

  protected async dismissAlert(seconds: number): Promise<void> {
    const message = await browserMessage(this.page, seconds, true);
    this.say('dismiss-alert', message.message(), '');
    await message.dismiss();
    this.picture();
  }

  /** types the answer into the browser's question and accepts it (Playwright answers on accept) */
  protected async typeInAlert(text: string, seconds: number): Promise<void> {
    const message = await browserMessage(this.page, seconds, true);
    this.say('accept-alert', message.message(), '');
    await message.accept(text);
    this.picture();
  }

  /** the open browser message's words; it stays open */
  protected async alertText(seconds: number): Promise<string> {
    return (await browserMessage(this.page, seconds, false)).message();
  }

  /** uploads a Test Data attachment through a file field - a hidden one too, so point at the input, not its button */
  protected async uploadAttachment(selector: string, seconds: number, attachment: string, element = selector): Promise<void> {
    const file = attachmentPath(attachment);
    const found = this.at(selector);
    await this.guarded(() => found.waitFor({ state: 'attached', timeout: seconds * 1000 })).catch((e: unknown) => {
      throw new Error(`The ${element} file field was not on the page within ${seconds} s`, { cause: e });
    });
    this.say('upload', element, selector);
    await this.guarded(() => found.setInputFiles(file, { timeout: seconds * 1000 }));
    this.picture();
  }

  /** empties the field, then types key by key with delayMs between keys (fields that check every key) */
  protected async typeSlowly(selector: string, text: string, delayMs = 100, element = selector): Promise<void> {
    const found = await this.shown(selector, DEFAULT_SECONDS, element);
    this.say('type', element, selector, typedValue(element, selector, text, await passwordBox(found, 1000)));
    await this.markFound(found, 'type');
    await this.guarded(async () => {
      await found.fill('');
      await found.click();
      await found.pressSequentially(text, { delay: delayMs });
    });
    this.picture();
  }

  private async choose(selector: string, seconds: number, element: string, has: (o: { label: string; value: string; index: number }) => boolean,
                       missing: string, option: { label?: string; value?: string; index?: number }): Promise<void> {
    const found = await this.shown(selector, seconds, element);
    const options = await found.evaluate((e) => [...(e as HTMLSelectElement).options].map((o, index) => ({ label: o.text, value: o.value, index })));
    if (!options.some(has)) throw new Error(`The ${element} list has ${missing}`);
    const chosen = options.find(has);
    this.say('select', element, selector, typedValue(element, selector, chosen?.label.trim() || chosen?.value || ''));
    await this.markFound(found, 'select');
    await this.guarded(() => found.selectOption(option, { timeout: seconds * 1000 }));
    this.picture();
  }
}
