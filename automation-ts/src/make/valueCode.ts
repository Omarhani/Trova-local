import { quote, valueVar } from './names';

const ONE = /^\{([A-Za-z_][\w.-]*)}$/;
const ANY = /\{([A-Za-z_][\w.-]*)}/g;
const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * Make automation: a value of the AI run as the code that reads it - a case value by its name ({leave_type_name} ->
 * the block's value read once), a value kept from an answer by its local name, anything else as written.
 */
export class ValueCode {
  /** the case values this test reads, by name */
  readonly used = new Set<string>();
  private readonly kept = new Map<string, string>();

  constructor(private readonly values: Readonly<Record<string, string>>) {}

  /** a value kept from an answer is read from now on by this local name */
  keep(name: string, local: string): void {
    this.kept.set(name, local);
  }

  isKept(name: string): boolean {
    return this.kept.has(name);
  }

  /** the code for a text: a local name, a literal in quotes, or a template mixing both */
  text(text: string): string {
    const one = ONE.exec(text.trim());
    if (one && this.known(one[1])) return this.local(one[1]);
    if (![...text.matchAll(ANY)].some((m) => this.known(m[1]))) return quote(text);
    const escaped = (s: string): string => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    let out = '';
    let at = 0;
    for (const m of text.matchAll(ANY)) {
      if (!this.known(m[1])) continue;
      out += `${escaped(text.slice(at, m.index))}\${${this.local(m[1])}}`;
      at = (m.index ?? 0) + m[0].length;
    }
    return `\`${out}${escaped(text.slice(at))}\``;
  }

  /** a call's body as an object literal, its values by name */
  body(value: unknown): string {
    if (typeof value === 'string') return this.text(value);
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
    if (Array.isArray(value)) return `[${value.map((v) => this.body(v)).join(', ')}]`;
    const fields = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${IDENT.test(k) ? k : quote(k)}: ${this.body(v)}`);
    return fields.length ? `{ ${fields.join(', ')} }` : '{}';
  }

  /** the kept or case value names a text reads */
  names(text: string): string[] {
    return [...text.matchAll(ANY)].map((m) => m[1]).filter((n) => this.known(n));
  }

  private known(name: string): boolean {
    return this.kept.has(name) || Object.prototype.hasOwnProperty.call(this.values, name);
  }

  private local(name: string): string {
    const kept = this.kept.get(name);
    if (kept) return kept;
    this.used.add(name);
    return valueVar(name);
  }
}
