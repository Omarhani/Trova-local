import { AreaName } from './classPlacer';
import { keyParts, ROW } from './locatorKey';
import { camel, pascal, quote } from './names';

/** an import a part needs in its class file */
export interface Import {
  name: string;
  from: string;
}

/** one part Trova adds to a class: its element (a field, or a locator of a row) and its method (at most ~10 lines) */
export interface Part {
  name: string;
  field?: string;
  locator?: string[];
  method: string[];
  imports: Import[];
}

export type UiAction = 'click' | 'type' | 'tap';

const BY_IMPORT: Record<AreaName, Import> = {
  web: { name: 'By', from: '../by' },
  phone: { name: 'AppiumBy', from: '../../web/by' },
  api: { name: 'By', from: '../by' },
};
const VERB: Record<UiAction, string> = { click: 'click', type: 'enter', tap: 'tap' };
const SECONDS: Record<UiAction, number> = { click: 15, type: 10, tap: 15 };

/** the lines a part adds to its class, with the blank line before its method */
export function partLines(p: Part): number {
  return (p.field ? 1 : 0) + (p.locator ? p.locator.length + 1 : 0) + p.method.length + 1;
}

/** a name not yet used in the class: name, name2, name3 ... */
export function freeName(name: string, used: ReadonlySet<string>): string {
  let n = 1;
  while (used.has(n === 1 ? name : `${name}${n}`)) n++;
  return n === 1 ? name : `${name}${n}`;
}

/** By.xpath("...") written the way the page classes write it; a {row} becomes the row parameter */
function byText(area: AreaName, key: string): string {
  const { by, value } = keyParts(key);
  const holder = area === 'phone' ? 'AppiumBy' : 'By';
  const text = value.split(ROW).map((p) => JSON.stringify(p)).join(' + row + ');
  return `${holder}.${by}(${text})`;
}

/** a click, type or tap on one element: one field (or row locator) and one method that names it in plain words */
export function uiPart(area: AreaName, action: UiAction, element: string, key: string, used: ReadonlySet<string>): Part {
  const stem = pascal(element) || 'Element';
  const name = freeName(`${VERB[action]}${stem}`, used);
  const field = freeName(`${camel(stem)}${action === 'type' ? 'Field' : 'Button'}`, new Set([...used, name]));
  const row = key.includes(ROW);
  const target = row ? `this.${field}(row)` : `this.${field}`;
  const arg = action === 'type' ? 'value: string' : row ? 'row: string' : '';
  const rest = action === 'type' ? ', value' : '';
  const method = [`  async ${name}(${arg}): Promise<void> {`,
    `    await this.${action}(${target}, ${SECONDS[action]}${rest}, ${quote(element || stem)});`, '  }'];
  if (!row) return { name, field: `  private readonly ${field} = ${byText(area, key)};`, method, imports: [BY_IMPORT[area]] };
  const locator = [`  private ${field}(row: string): string {`, `    return ${byText(area, key)};`, '  }'];
  return { name, locator, method, imports: [BY_IMPORT[area]] };
}

/** opens the page by its address in the app (BasePage's open, which loads a hung page once more) */
export function openPart(page: string, viaOpen: boolean, used: ReadonlySet<string>): Part {
  const name = freeName(`open${pascal(page) || 'Home'}`, used);
  const url = `testData.webUrl().replace(/\\/+$/, '') + ${quote(page.startsWith('/') ? page : `/${page}`)}`;
  const go = viaOpen ? `    await this.open(${url});`
    : `    await this.page.goto(${url}, { waitUntil: 'domcontentloaded', timeout: 30_000 });`;
  return { name, method: [`  /** opens ${page} */`, `  async ${name}(): Promise<void> {`, go, '  }'],
    imports: [{ name: 'testData', from: '../../run/testData' }] };
}

/** one of Trova's known calls of the app ("POST /Department/AddDepartment") with the values given by field name */
export function callPart(endpoint: string, used: ReadonlySet<string>): Part {
  const [verb, path] = endpoint.split(' ');
  const last = path.split(/[/?]/).filter((p) => p && !p.startsWith('{')).pop() ?? '';
  const whole = camel(`${verb.toLowerCase()} ${path}`);
  const stem = camel(last) && !/^(get|post|put|patch|call|delete|send)$/.test(camel(last)) ? camel(last) : whole;
  const name = freeName(stem, used);
  return { name, imports: [{ name: 'HttpAnswer', from: '../http' }], method: [
    `  /** ${endpoint} - Trova's known call, filled with the values by field name */`,
    `  async ${name}(values: Record<string, unknown> = {}): Promise<HttpAnswer> {`,
    `    return this.api.call(${quote(endpoint)}, values);`, '  }'] };
}
