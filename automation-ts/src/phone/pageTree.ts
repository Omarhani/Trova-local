/**
 * The elements of a phone page tree, each as a reader of its attributes - for both forms: a uiautomator dump (<node ...>)
 * and Appium's page source (each element named by its class, <android.widget.EditText ...>; seen on the real phone).
 */
export type Attr = (name: string) => string;

const ELEMENT = /<(?![/?!])(?!hierarchy\b)([\w.$]+)\b([^>]*?)\/?>/g;

export function elements(xml: string): Attr[] {
  const out: Attr[] = [];
  for (const m of xml.matchAll(ELEMENT)) {
    const attrs = m[2];
    out.push((name) => decode(new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? ''));
  }
  return out;
}

function decode(s: string): string {
  return s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
