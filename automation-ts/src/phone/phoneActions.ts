import { typeText } from '../core/phoneTyping';
import { clearCommands, clearCount, FULL, typedRight, wrongField } from '../core/fieldKeys';
import { emit } from '../report/liveEvents';
import { typedValue, ValueFields } from '../report/typedValue';
import { currentStep, nextStep } from '../report/stepNumbers';
import { liveFrames } from '../report/liveFrames';
import { ScreenSnapshot } from './screenSnapshot';
import { onPhone } from './phoneGone';
import { PhoneFilm } from './phoneFilm';
import { Phone } from './phoneSession';
import { phoneAid, PhoneAid } from './phoneHelpAsk';
import { lookWithHelp, notShownWords } from './phoneStepHelp';
import { lookPastQuestions } from './permissionQuestion';
import { answerOf, optionalPopupSeconds, popupKind, popupNote, questionWords, systemPopup } from './optionalPopup';

/** the time between two looks at the screen - never a fixed sleep (the AI-run tools read the screen in about 0.2 s) */
const LOOK_EVERY_MS = 200;

/**
 * The screen actions every phone screen object stands on - look, act like a finger, say the step in Trova's live feed -
 * the TS twin of utils.MethodHandlesMobile. Test 8094 runs 587/588 (147-184 s, the AI run 102 s): every check is a look
 * at ONE page tree (ScreenSnapshot), taps go where a finger would (adb tap in the element's middle). A wait fails in plain
 * words (what did not show within N s).
 */
export class PhoneActions {
  /** aid: a step whose element does not show asks Trova's AI help (Omar 2026-11-11: self-healing on the phone) */
  constructor(protected readonly phone: Phone, private readonly aid: PhoneAid = phoneAid) {}

  protected async tap(selector: string, seconds: number, element = selector): Promise<void> {
    if (systemPopup(selector)) return this.tapPopup(selector, seconds, element); // Omar 2026-11-12 (run 985): may or may not appear
    const [x, y] = await this.sayAt('click', element, selector, seconds); // the run screen's word ("tap" read as "tab")
    await this.shell('input', 'tap', String(x), String(y));
    this.picture();
  }

  /**
   * Omar 2026-11-12 (Test 8094 run 985, case 519): a step on Android's own permission question - it may or may not
   * appear, and that never decides the case. There: answered as the step says, with a warning. Not there within its
   * wait (3 s at most): the step is skipped with a warning - no AI help, no failure. The case's own checks decide.
   */
  private async tapPopup(selector: string, seconds: number, element: string): Promise<void> {
    const s = await this.lookUntil((x) => x.has(selector), optionalPopupSeconds(seconds));
    const at = s?.middle(selector);
    if (!s || !at) {
      this.say('click', `${element} - not asked this time, skipped`, selector);
      popupNote(popupKind(element), false, element, answerOf(selector));
      return;
    }
    this.say('click', element, selector, s.mark(selector) ?? {});
    await this.shell('input', 'tap', String(at[0]), String(at[1]));
    this.picture();
    popupNote(popupKind(questionWords(s) || element), true, element, answerOf(selector));
  }

  /** a tap at a point, for an icon with no element of its own (placed from the element it sits on) */
  protected async tapAt(x: number, y: number, element: string): Promise<void> {
    this.say('click', element, `point ${x},${y}`);
    await this.shell('input', 'tap', String(x), String(y));
    this.picture();
  }

  /**
   * taps the field the way a finger does, empties it from both ends (Trova's AI-run way, core/fieldKeys), types the value
   * the AI-run way (core/phoneTyping, Arabic through the Unicode keyboard) and reads the box back: it must hold exactly
   * the value. Omar 2026-11-11 (case 462): select all + delete took one letter off the account code and the step went on
   * green. A box left wrong is emptied and typed once more (a lost key), then the step fails as Expected / Actual.
   */
  protected async type(selector: string, seconds: number, value: string, element = selector): Promise<void> {
    const shown = typedValue(element, selector, value);
    const [x, y] = await this.sayAt('type', element, selector, seconds, shown);
    await this.shell('input', 'tap', String(x), String(y));
    if (await this.typedInto(selector, value, clearCount((await this.look()).field(selector)))) return this.picture();
    await this.shell('input', 'tap', String(x), String(y));
    const field = (await this.typedInto(selector, value, FULL)) ? undefined : (await this.look()).field(selector);
    this.picture();
    if (field) throw new Error(wrongField(element, value, field.text, shown.secret === true));
  }

  /** empties the focused box with this many delete keys and types the value; true when the box then holds exactly it */
  private async typedInto(selector: string, value: string, keys: number): Promise<boolean> {
    for (const command of clearCommands(keys)) await this.shell(...command);
    await typeText(this.shell, value);
    return typedRight((await this.look()).field(selector), value);
  }

  /** the screen now: one page tree */
  protected async look(): Promise<ScreenSnapshot> {
    return ScreenSnapshot.of(await onPhone(() => this.phone.getPageSource()));
  }

  /** looks until the screen matches (every 0.2 s, at most seconds); the last look when it did, else undefined */
  protected async lookUntil(match: (s: ScreenSnapshot) => boolean, seconds: number): Promise<ScreenSnapshot | undefined> {
    const until = Date.now() + seconds * 1000;
    for (;;) {
      const s = await this.look();
      if (match(s)) return s;
      if (Date.now() >= until) return undefined;
      await this.pause(LOOK_EVERY_MS);
    }
  }

  /** a text shows on the screen (an element's text or description holds it) within seconds - every screen's check */
  async shows(text: string, seconds = 10): Promise<boolean> {
    return (await this.lookUntil((s) => s.nodes.some((n) => n.text.includes(text) || n.desc.includes(text)), seconds)) !== undefined;
  }

  protected async isPresent(selector: string, seconds: number): Promise<boolean> {
    return (await this.lookUntil((s) => s.has(selector), seconds)) !== undefined;
  }

  protected async pause(ms: number): Promise<void> {
    await this.phone.pause(ms);
  }

  /** one `adb shell` command on the phone (Appium allows it: uiautomator2:adb_shell); plain words when the phone is gone */
  protected readonly shell = async (...args: string[]): Promise<string> =>
    String((await onPhone(() => this.phone.execute('mobile: shell', { command: args[0], args: args.slice(1) }))) ?? '');

  /**
   * waits for the element, then says the step with the element's box (Omar 2026-11-11: the run page marks it like a web
   * step - a box and a tap mark); the step is said even when the element never shows, then fails in plain words. Not
   * shown within its wait = AI help first (lookWithHelp), as a stuck web step
   */
  private async sayAt(action: string, element: string, selector: string, seconds: number, value: ValueFields | Record<string, never> = {}): Promise<[number, number]> {
    const stack = new Error().stack; // the screen's step that called, before the first wait
    const look = (n: number): Promise<ScreenSnapshot | undefined> =>
      lookPastQuestions((match, k) => this.lookUntil(match, k), (xy, seen) => this.allowQuestion(xy, seen), selector, n); // run 870
    const { screen: s, fail } = await lookWithHelp(look, this.aid,
      { screen: this.constructor.name, element, selector, action, seconds, stack });
    const at = s?.middle(selector);
    this.say(action, element, selector, { ...value, ...(at ? s?.mark(selector) : {}) });
    if (!at) throw fail ?? new Error(notShownWords(element, seconds));
    return at;
  }

  /** Android's permission question answered "allow", said as its own step on the run page */
  private async allowQuestion([x, y]: [number, number], seen: ScreenSnapshot): Promise<void> {
    this.say('click', "Allow (Android's permission question)", 'Android permission question');
    await this.shell('input', 'tap', String(x), String(y));
    this.picture();
    popupNote(popupKind(questionWords(seen)), true, "Allow (Android's permission question)"); // Omar 2026-11-12: a warning, never a failure
  }

  /** the live view's picture of the step just done (one every 600 ms at most; the test never waits for it) */
  private picture(): void {
    PhoneActions.picture(this.phone);
  }

  /**
   * the phone's picture for the step just done or a check just made - every one, never skipped (run 598): the film's
   * next picture, else (no film) a screenshot
   */
  static picture(phone: Phone): void {
    if (!liveFrames.on()) return;
    const step = currentStep();
    if (PhoneFilm.current?.stepPicture(step)) return;
    void phone.takeScreenshot().then((png) => liveFrames.add(Buffer.from(png, 'base64'), step, 'png', true), () => undefined);
  }

  private say(action: string, element: string, selector: string, value: Record<string, unknown> = {}): void {
    const n = nextStep();
    emit('step', { n, a: action, e: element, l: selector.slice(0, 160), ...value });
    PhoneFilm.current?.atStep(n);
  }
}
