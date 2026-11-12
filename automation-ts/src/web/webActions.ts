import { Locator, Page } from '@playwright/test';
import { emit } from '../report/liveEvents';
import { typedValue, ValueFields } from '../report/typedValue';
import { currentStep, nextStep } from '../report/stepNumbers';
import { markStep } from './stepMark';
import { stepPictures } from './stepPictures';
import { settle } from './covers';
import { readSwitchFacts, switchIsOn } from './switchState';
import { withoutClose } from './uiText';
import { locate } from './anyOf';
import { doneOrMessage } from './browserMessages';
import { ownBoxReady, passwordBox } from './ownBox';
import { stepGuard } from './signin/signedOutStep';
import { actionStarts, messageAfterAction } from './shownMessages';

/** the least time the action itself gets once its element showed (it was found: only its own readiness is left) */
export const ACTION_FLOOR_MS = 5_000;

/**
 * The page actions every web page object stands on - wait for the element, act, say the step in Trova's live feed -
 * the TS twin of utils.MethodHandlesWeb. A wait fails in plain words (what did not happen within N s).
 */
export class WebActions {

  constructor(protected readonly page: Page) {}

  protected async click(selector: string, seconds: number, element = selector): Promise<void> {
    this.say('click', element, selector);
    const found = this.at(selector);
    await this.guarded(async () => {
      const left = await this.marked(found, 'click', seconds);
      actionStarts(this.page); // the message this click brings is one shown from now on (run 994)
      await doneOrMessage(this.page, found.click({ timeout: left }));
    });
    this.picture();
  }

  /** empties the field (both ends) and types the value */
  protected async type(selector: string, seconds: number, value: string, element = selector): Promise<void> {
    const found = this.at(selector);
    const secret = await passwordBox(found, seconds * 1000);
    this.say('type', element, selector, typedValue(element, selector, value, secret));
    await this.guarded(async () => {
      const left = await this.marked(found, 'type', seconds);
      const force = await ownBoxReady(found, left);
      await found.fill('', { timeout: left, force });
      await found.fill(value, { timeout: seconds * 1000, force });
    });
    this.picture();
  }

  /** a read-only box a picker fills (date / time): its value set by script with input + change, as the picker does (Java insertTimeMovement) */
  protected async putValue(selector: string, seconds: number, value: string, element = selector): Promise<void> {
    this.say('type', element, selector, typedValue(element, selector, value));
    const found = this.at(selector);
    await this.guarded(async () => {
      await found.waitFor({ state: 'attached', timeout: seconds * 1000 });
      await this.markFound(found, 'type');
      await found.evaluate((e, v) => {
        const box = e as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box, v);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    });
    this.picture();
  }

  /** a click the page's script makes on the element's button (one a layer still fading out would catch - Java JS click) */
  protected async clickByScript(selector: string, seconds: number, element = selector): Promise<void> {
    this.say('click', element, selector);
    const found = this.at(selector);
    await this.guarded(async () => {
      await found.waitFor({ state: 'attached', timeout: seconds * 1000 });
      await this.markFound(found, 'click');
      actionStarts(this.page);
      await found.evaluate((e) => ((e.closest('button') ?? e) as HTMLElement).click());
    });
    this.picture();
  }

  protected async textOf(selector: string, seconds: number): Promise<string> {
    await this.visible(selector, seconds);
    return (await this.at(selector).innerText()).trim();
  }

  /** a text shows on the page (any shown element holding it) within seconds - every page's check of what it shows */
  async shows(text: string, seconds = 10): Promise<boolean> {
    return this.page.getByText(text).filter({ visible: true }).first()
      .waitFor({ state: 'visible', timeout: seconds * 1000 }).then(() => true, () => false);
  }

  protected async isShownWithin(selector: string, seconds: number): Promise<boolean> {
    return this.at(selector).waitFor({ state: 'visible', timeout: seconds * 1000 }).then(() => true, () => false);
  }

  protected async isGoneWithin(selector: string, seconds: number): Promise<boolean> {
    return this.all(selector).first().waitFor({ state: 'hidden', timeout: seconds * 1000 }).then(() => true, () => false);
  }

  /** the number of matches once it is expected (waits up to seconds); the last count read otherwise */
  protected async countBecomes(selector: string, expected: number, seconds: number): Promise<number> {
    const until = Date.now() + seconds * 1000;
    let count = await this.all(selector).count();
    while (count !== expected && Date.now() < until) {
      await this.page.waitForTimeout(250);
      count = await this.all(selector).count();
    }
    return count;
  }

  /** the field's value once it shows expected (waits up to seconds); what it holds otherwise */
  protected async valueBecomes(selector: string, expected: string, seconds: number): Promise<string> {
    await this.visible(selector, seconds);
    return this.at(selector).inputValue().then(async (v) => {
      const until = Date.now() + seconds * 1000;
      let value = v;
      while (value !== expected && Date.now() < until) {
        await this.page.waitForTimeout(250);
        value = await this.at(selector).inputValue();
      }
      return value;
    });
  }

  /** a message box's own words once it shows (a close mark "×" left out, spaces made single); "" when none shows */
  protected async messageOf(selector: string, seconds: number): Promise<string> {
    if (!(await this.isShownWithin(selector, seconds))) return '';
    return withoutClose(await this.at(selector).innerText().catch(() => ''));
  }

  /**
   * the toast check (run 994): the message expected among those the page showed since the last click - kept as they
   * show, so one that came and went counts - or in the box now; waited up to seconds. Else the last one seen, "" when none
   */
  protected async toastAfterAction(selector: string, expected: string, seconds: number): Promise<string> {
    const want = withoutClose(expected);
    return messageAfterAction(this.page, (t) => t === want, seconds, () => this.firstText(selector));
  }

  /** the first message the page showed since the last click that isIt (any, by default) - as toastAfterAction */
  protected async firstToastAfterAction(selector: string, seconds: number, isIt: (t: string) => boolean = (t) => t !== ''): Promise<string> {
    return messageAfterAction(this.page, isIt, seconds, () => this.firstText(selector));
  }

  /** the first match's text now ("" when none is there) - never waits */
  private async firstText(selector: string): Promise<string> {
    const found = this.all(selector).first();
    return (await found.count()) > 0 ? withoutClose(await found.innerText({ timeout: 1000 }).catch(() => '')) : '';
  }

  /** the element's message once it reads expected (waits up to seconds); the last message seen, "" when none showed */
  protected async textBecomes(selector: string, expected: string, seconds: number): Promise<string> {
    const want = withoutClose(expected);
    const until = Date.now() + seconds * 1000;
    let last = '';
    do {
      const found = this.all(selector).first();
      if ((await found.count()) > 0) last = withoutClose(await found.innerText().catch(() => last));
      if (last === want) return last;
      await this.page.waitForTimeout(250);
    } while (Date.now() < until);
    return last;
  }

  /** true once every shown match is disabled (disabled or aria-disabled="true") within seconds; false when it stays enabled */
  protected async isDisabledWithin(selector: string, seconds: number): Promise<boolean> {
    const until = Date.now() + seconds * 1000;
    do {
      const states = await this.all(selector).evaluateAll((all) => all
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => (e as HTMLButtonElement).disabled === true || e.getAttribute('aria-disabled') === 'true'));
      if (states.length > 0 && states.every(Boolean)) return true;
      await this.page.waitForTimeout(250);
    } while (Date.now() < until);
    return false;
  }

  /** true as soon as a shown match is enabled; false when none is within seconds */
  protected async isEnabledWithin(selector: string, seconds: number): Promise<boolean> {
    const until = Date.now() + seconds * 1000;
    do {
      const states = await this.all(selector).evaluateAll((all) => all
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => (e as HTMLButtonElement).disabled !== true && e.getAttribute('aria-disabled') !== 'true'));
      if (states.some(Boolean)) return true;
      await this.page.waitForTimeout(250);
    } while (Date.now() < until);
    return false;
  }

  /** the number of matches once there is at least one (waits up to seconds); 0 when none came */
  protected async rowsShownWithin(selector: string, seconds: number): Promise<number> {
    return this.all(selector).first().waitFor({ state: 'attached', timeout: seconds * 1000 })
      .then(() => this.all(selector).count(), () => 0);
  }

  /** the count once the list has settled: the same count on 3 looks in a row (0.5 s apart), at most seconds */
  protected async settledCount(selector: string, seconds: number): Promise<number> {
    const until = Date.now() + seconds * 1000;
    let last = -1;
    let same = 0;
    while (same < 3 && Date.now() < until) {
      const now = await this.all(selector).count();
      same = now === last ? same + 1 : 0;
      last = now;
      if (same < 3) await this.page.waitForTimeout(500);
    }
    return Math.max(last, 0);
  }

  /** the field's value once it shows (up to 10 s); "" when it has none */
  protected async valueOf(selector: string): Promise<string> {
    await this.isShownWithin(selector, 10);
    return this.at(selector).inputValue().catch(() => '');
  }

  /** sets a switch on or off: reads it first, clicks only when it differs, then waits for the new state (utils.Switches) */
  protected async setSwitch(selector: string, on: boolean, seconds: number, name: string): Promise<void> {
    if (!(await this.isShownWithin(selector, Math.max(seconds, 20)))) {
      throw new Error(`The ${name} switch was not on the screen within ${Math.max(seconds, 20)} s - the page did not finish loading`);
    }
    await this.settled(5);
    if (switchIsOn(await this.at(selector).evaluate(readSwitchFacts)) === on) return;
    const action = on ? 'switch-on' : 'switch-off';
    this.say(action, name, selector);
    await this.markFound(this.at(selector), action);
    await this.guarded(() => this.at(selector).click({ timeout: seconds * 1000 })).catch(() => this.at(selector).evaluate((e) => (e as HTMLElement).click()));
    const until = Date.now() + seconds * 1000;
    while (switchIsOn(await this.at(selector).evaluate(readSwitchFacts)) !== on) {
      if (Date.now() > until) throw new Error(`The ${name} switch did not turn ${on ? 'on' : 'off'} within ${seconds} s`);
      await this.page.waitForTimeout(250);
    }
    this.picture();
  }

  /** presses a key in the field (e.g. Tab, so the form checks it) */
  protected async pressKey(selector: string, seconds: number, key: string, element = selector): Promise<void> {
    this.say('press ' + key, element, selector);
    const found = this.at(selector);
    await this.guarded(async () => {
      const left = await this.marked(found, 'press ' + key, seconds);
      await found.press(key, { timeout: left });
    });
    this.picture();
  }

  /** the page has settled as Java waits for it: loaded, no loading layer (max seconds) - never a fixed sleep */
  protected async settled(seconds: number): Promise<void> {
    await settle(this.page, seconds * 1000);
  }

  /** waits until the element shows; fails in plain words naming it */
  protected async shown(selector: string, seconds: number, element: string): Promise<Locator> {
    const found = this.at(selector);
    await this.guarded(() => found.waitFor({ state: 'visible', timeout: seconds * 1000 })).catch((e: unknown) => {
      throw new Error(`${element} did not show within ${seconds} s`, { cause: e });
    });
    return found;
  }

  private async visible(selector: string, seconds: number): Promise<void> {
    await this.guarded(() => this.at(selector).waitFor({ state: 'visible', timeout: seconds * 1000 })).catch((e: unknown) => {
      throw new Error(`"${selector}" did not show within ${seconds} s`, { cause: e });
    });
  }

  /** one wait or action through the run's step guard: a mid-test sign-out signs in again and runs it once more; stuck = AI help */
  protected guarded<T>(step: () => Promise<T>): Promise<T> {
    return stepGuard.once(this.page, step);
  }

  protected at(selector: string): Locator {
    return this.all(selector).first();
  }

  /** every match of the selector (an anyOf of mixed kinds too) */
  protected all(selector: string): Locator {
    return locate(this.page, selector);
  }

  /**
   * the step's element marked for its picture once it shows (Java's numbered box, a click mark for a mouse step), after
   * the picture before it is taken (1 s at most); gives back the time left of the step's own wait, never under
   * ACTION_FLOOR_MS - as Java, the action is not cut once its wait found the element (run 947 case 558: 1 ms)
   */
  protected async marked(found: Locator, action: string, seconds: number): Promise<number> {
    if (!stepPictures.on()) return seconds * 1000;
    const until = Date.now() + seconds * 1000;
    await found.waitFor({ state: 'visible', timeout: seconds * 1000 });
    await this.markFound(found, action);
    return Math.max(ACTION_FLOOR_MS, until - Date.now());
  }

  /** the shown element marked for the step's picture (nothing in a run without pictures) */
  protected async markFound(found: Locator, action: string): Promise<void> {
    if (!stepPictures.on()) return;
    await Promise.race([stepPictures.done(this.page), new Promise((r) => setTimeout(r, 1000))]);
    await markStep(found, currentStep(), action);
  }

  /** the live Browser's picture of the step just done (every step its own; the test never waits for it) */
  protected picture(): void {
    stepPictures.shoot(this.page, currentStep());
  }

  /** one step line; value = what it typed or chose (a secret as *** with its reference) */
  protected say(action: string, element: string, selector: string, value: ValueFields | Record<string, never> = {}): void {
    emit('step', { n: nextStep(), a: action, e: element, l: selector.slice(0, 160), ...value });
  }
}
