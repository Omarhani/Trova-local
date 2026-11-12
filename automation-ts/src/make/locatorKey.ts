/**
 * Make automation: a locator as one comparable key ("xpath://button[...]"), read the same way from the AI run's element
 * (By.xpath("...")) and from the page classes (By.xpath(FORM + "..."), By.id('iNotes')) - either quote, string constants
 * resolved, a row parameter read as {row}.
 */
export const ROW = '{row}';

/** the value of one quoted text starting at i, and where it ends; undefined when it is not closed */
function literalAt(expr: string, i: number): [string, number] | undefined {
  const q = expr[i];
  let out = '';
  for (let j = i + 1; j < expr.length; j++) {
    const c = expr[j];
    if (c === q) return [out, j + 1];
    if (c === '\\') {
      const n = expr[++j];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
    } else out += c;
  }
  return undefined;
}

/** "a" + NAME + 'b' -> the text it gives; NAME from consts, param as {row}; undefined for anything else */
export function textOf(expr: string, consts: ReadonlyMap<string, string> = new Map(), param?: string): string | undefined {
  let out = '';
  let i = 0;
  const skip = (): void => { while (i < expr.length && /\s/.test(expr[i])) i++; };
  for (skip(); i < expr.length; skip()) {
    if (expr[i] === '"' || expr[i] === "'") {
      const lit = literalAt(expr, i);
      if (!lit) return undefined;
      [out, i] = [out + lit[0], lit[1]];
    } else {
      const id = /^[A-Za-z_$][\w$]*/.exec(expr.slice(i))?.[0];
      if (!id) return undefined;
      const v = id === param ? ROW : consts.get(id);
      if (v === undefined) return undefined;
      [out, i] = [out + v, i + id.length];
    }
    skip();
    if (i < expr.length && expr[i++] !== '+') return undefined;
  }
  return out;
}

/** By.xpath("...") / AppiumBy.xpath(FORM + "...") / By.id('x') -> "xpath:...", "id:x"; undefined when it is not one */
export function locatorKey(expr: string, consts: ReadonlyMap<string, string> = new Map(), param?: string): string | undefined {
  const m = /^\s*(?:Appium)?By\.(\w+)\(([\s\S]*)\)\s*$/.exec(expr);
  if (!m) return undefined;
  const value = textOf(m[2], consts, param);
  return value === undefined ? undefined : `${m[1]}:${value}`;
}

/** the parts of a key: how it finds ("xpath") and what ("//button[...]") */
export function keyParts(key: string): { by: string; value: string } {
  const at = key.indexOf(':');
  return { by: key.slice(0, at), value: key.slice(at + 1) };
}
