import { Locator, Page } from '@playwright/test';
import { ClockTime } from './clockTime';
import { settle } from './covers';
import { locate } from './anyOf';

/** the clock dialog on top: Angular Material style (mat-clock / a time-frame header) */
const DIALOG = "xpath=(//*[self::mat-dialog-container or @role='dialog'][.//mat-clock or .//*[contains(@class,'time-frame')]])[last()]";
const HEADER = '.time-frame span.time, .time-frame .time';
const HALVES = '.ampm span, .ampm button, .ampm div';
const FACE = 'mat-clock .circle, .clock-face, mat-clock';
const NUMBERS = 'mat-clock button.number, button.number';
const ACTIONS = 'mat-dialog-actions button, .mat-dialog-actions button, .actions button';
const OK_WORDS = ['ok', 'save', 'set', 'done', 'حفظ', 'موافق', 'تم'];
const FALLBACK_RADIUS = 108; // Availo's numbers sit 108 px from the face's centre

const two = (n: number): string => String(n).padStart(2, '0');

/** reads until it gives a value (not undefined) or ms pass; the last read then */
async function within<T>(ms: number, read: () => Promise<T | undefined>): Promise<T | undefined> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await read().catch(() => undefined);
    if (v !== undefined || Date.now() >= until) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Sets a time field to time ("18:00", "6:30 pm", Arabic digits) in one call - the TS twin of utils.TimePicker. A field
 * that takes typing gets the time typed (a native time box HH:mm); a read-only one opens its clock dialog: AM / PM, the
 * hour header and its place on the face, the minute header and its place - each checked in the header and tried again
 * (at most 3) - then OK, and the field is read back until it shows the time. Gives back what the field shows.
 */
export async function setTime(page: Page, field: string, time: string, seconds = 10, name?: string): Promise<string> {
  const want = ClockTime.parse(time);
  const s = Math.max(1, seconds);
  const what = name?.trim() ? `The ${name.trim()} field` : 'The time field';
  await settle(page, s * 1000);
  const input = locate(page, field).first();
  if (!(await input.waitFor({ state: 'visible', timeout: s * 1000 }).then(() => true, () => false))) {
    throw new Error(`${what} was not on the screen within ${s} s`);
  }
  if (await takesTyping(input)) await typeTime(input, time.trim(), want);
  else await pick(page, input, want, s, what);
  const shown = await within(s * 1000, async () => {
    const v = (await input.inputValue()).trim();
    return want.matches(v) ? v : undefined;
  });
  if (shown === undefined) throw new Error(`${what} shows "${(await input.inputValue().catch(() => '')).trim()}" after choosing ${want}`);
  return shown;
}

/** a plain or native time input (not read-only, no clock dialog behind it) */
async function takesTyping(input: Locator): Promise<boolean> {
  return input.evaluate((e) => {
    const ro = e.getAttribute('readonly');
    return !(ro !== null && ro.toLowerCase() !== 'false') && e.getAttribute('mattimepicker') === null;
  });
}

async function typeTime(input: Locator, text: string, want: ClockTime): Promise<void> {
  if ((await input.getAttribute('type'))?.toLowerCase() === 'time') { // a native time box takes HH:mm
    await input.fill(`${two(want.hour24)}:${two(want.minute)}`);
    return;
  }
  await input.fill('');
  await input.fill(text);
  await input.press('Tab');
}

async function pick(page: Page, input: Locator, want: ClockTime, s: number, what: string): Promise<void> {
  await input.click({ timeout: s * 1000 });
  const dialog = page.locator(DIALOG);
  if (!(await dialog.waitFor({ state: 'visible', timeout: s * 1000 }).then(() => true, () => false))) {
    throw new Error(`${what}'s clock did not open within ${s} s`);
  }
  const twelve = await half(dialog, want);
  const hour = twelve ? want.hour12() : want.hour24;
  const hourHeader = twelve ? want.hourHeader() : two(want.hour24);
  await face(dialog, 0, hour % 12 === 0 ? 12 : hour % 12, 12, !twelve && want.innerRing24(), hourHeader, `${what}'s clock hour`);
  await face(dialog, 1, want.minute, 60, false, want.minuteHeader(), `${what}'s clock minute`);
  const ok = await okButton(dialog);
  if (!ok) throw new Error(`${what}'s clock has no OK button`);
  await ok.click({ timeout: s * 1000 });
  if (!(await dialog.waitFor({ state: 'hidden', timeout: s * 1000 }).then(() => true, () => false))) {
    throw new Error(`${what}'s clock did not close after OK`);
  }
}

/** clicks AM / PM when the clock has them; false = a 24-hour clock */
async function half(dialog: Locator, want: ClockTime): Promise<boolean> {
  const halves = dialog.locator(HALVES);
  const texts = (await halves.allInnerTexts()).map((t) => t.trim().toLowerCase());
  const at = texts.findIndex((t) => (want.pm() ? t === 'pm' || t === 'م' : t === 'am' || t === 'ص'));
  if (at >= 0) {
    await halves.nth(at).click({ timeout: 5000 });
    return true;
  }
  return texts.some((t) => t !== '');
}

/** header part (0 hour, 1 minute) chosen, then value out of full clicked on the face, until the header shows it */
async function face(dialog: Locator, part: number, value: number, full: number, inner: boolean, header: string, what: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const heads = dialog.locator(HEADER);
    if ((await heads.count()) > part) await heads.nth(part).click({ timeout: 5000 });
      const shown = await within(5000, () => visibleFace(dialog));
    if (!shown) throw new Error(`${what}: the clock face did not show`);
    const { round, box } = shown;
    const [x, y] = ClockTime.offset(value, full, (await radius(dialog, box)) * (inner ? 0.62 : 1));
    await round.click({ position: { x: box.width / 2 + x, y: box.height / 2 + y } });
    const done = await within(3000, async () => ((await heads.nth(part).innerText()).trim() === header ? true : undefined));
    if (done) return;
  }
  throw new Error(`${what} did not show ${header} after 3 tries`);
}

/** the first face kind on show, in FACE's order (the drawn circle before its wrapper) */
async function visibleFace(dialog: Locator): Promise<{ round: Locator; box: { x: number; y: number; width: number; height: number } } | undefined> {
  for (const kind of FACE.split(', ')) {
    const round = dialog.locator(kind).locator('visible=true').first();
    const box = await round.boundingBox({ timeout: 500 }).catch(() => null);
    if (box && box.width > 0 && box.height > 0) return { round, box };
  }
  return undefined;
}

/** how far the numbers sit from the face's centre: measured on its "12" / "00", else 108 px */
async function radius(dialog: Locator, face: { x: number; y: number; width: number; height: number }): Promise<number> {
  const numbers = dialog.locator(NUMBERS);
  const texts = await numbers.allInnerTexts().catch(() => [] as string[]);
  for (let i = 0; i < texts.length; i += 1) {
    if (texts[i].trim() !== '12' && texts[i].trim() !== '00') continue;
    const n = await numbers.nth(i).boundingBox().catch(() => null); // the face re-draws between hours and minutes
    if (!n) continue;
    const r = Math.hypot(n.x + n.width / 2 - (face.x + face.width / 2), n.y + n.height / 2 - (face.y + face.height / 2));
    if (r > 20) return r;
  }
  return FALLBACK_RADIUS;
}

/** the button with an OK word, else the last action (Cancel, OK) */
async function okButton(dialog: Locator): Promise<Locator | undefined> {
  const buttons = dialog.locator(ACTIONS);
  const texts = (await buttons.allInnerTexts()).map((t) => t.trim().toLowerCase());
  const at = texts.findIndex((t) => OK_WORDS.includes(t));
  if (at >= 0) return buttons.nth(at);
  return texts.length ? buttons.nth(texts.length - 1) : undefined;
}
