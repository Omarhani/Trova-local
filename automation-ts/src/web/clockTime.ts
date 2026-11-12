const TIME = /^(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|ص|م)?$/;

/** Arabic-Indic digits as 0-9 */
function western(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The time a test asks for ("18:00", "6 pm", "6:30 PM", Arabic digits and ص / م) read once into what a clock dialog
 * needs - the 12-hour number, AM / PM, the two-digit header - and compared with what the field shows afterwards
 * ("6:00 pm" and "18:00" are the same time). The TS twin of utils.ClockTime; used by the time picker.
 */
export class ClockTime {
  private constructor(readonly hour24: number, readonly minute: number) {}

  /** the time in text; a wrong one fails in plain words */
  static parse(text: string): ClockTime {
    const t = ClockTime.read(text);
    if (!t) throw new Error(`"${text}" is not a time - write it like 18:00 or 6:00 pm`);
    return t;
  }

  /** the time in text, undefined when it is not one */
  static read(text: string | null | undefined): ClockTime | undefined {
    if (text == null) return undefined;
    const m = TIME.exec(western(text).trim().toLowerCase());
    if (!m) return undefined;
    const hour = Number(m[1]);
    const minute = m[2] === undefined ? 0 : Number(m[2]);
    if (minute > 59) return undefined;
    if (m[3] === undefined) return hour > 23 ? undefined : new ClockTime(hour, minute);
    if (hour < 1 || hour > 12) return undefined; // "13:00 pm" / "0:00 am" are not 12-hour times
    const pm = m[3].startsWith('p') || m[3] === 'م';
    return new ClockTime((hour % 12) + (pm ? 12 : 0), minute);
  }

  /** where value out of full sits on a face of radius px: [x, y] from its centre (12 / 0 = the top) */
  static offset(value: number, full: number, radius: number): [number, number] {
    const angle = (2 * Math.PI * (value % full)) / full;
    return [Math.round(radius * Math.sin(angle)) || 0, Math.round(-radius * Math.cos(angle)) || 0];
  }

  /** true when the field's shown value is this same time in any writing */
  matches(shown: string | null | undefined): boolean {
    const t = ClockTime.read(shown);
    return t !== undefined && t.hour24 === this.hour24 && t.minute === this.minute;
  }

  /** the hour on a 12-hour clock: 1-12 (midnight and noon = 12) */
  hour12(): number {
    return this.hour24 % 12 === 0 ? 12 : this.hour24 % 12;
  }

  pm(): boolean {
    return this.hour24 >= 12;
  }

  /** the hour as the dialog's header shows it ("09", "12") */
  hourHeader(): string {
    return two(this.hour12());
  }

  minuteHeader(): string {
    return two(this.minute);
  }

  /** on a 24-hour face 1-12 sit on the outer ring, 13-23 and 00 on the inner one */
  innerRing24(): boolean {
    return this.hour24 === 0 || this.hour24 > 12;
  }

  toString(): string {
    return `${this.hour12()}:${two(this.minute)} ${this.pm() ? 'pm' : 'am'}`;
  }
}
