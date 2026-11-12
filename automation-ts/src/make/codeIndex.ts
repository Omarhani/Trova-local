import { CodeFile } from './draft';
import { locatorKey, textOf } from './locatorKey';

/** one public method of a page, screen or API class as Trova reads it */
export interface IndexedMethod {
  name: string;
  params: number;
  /** the ONE action it does on one element (click / type / tap) and that element's key; none when it does more */
  action?: string;
  key?: string;
  /** its element is a locator of a row (the method takes the row's text) */
  row?: boolean;
  /** the app call it makes ("POST /Department/AddDepartment") */
  endpoint?: string;
  body: string;
}

export interface IndexedClass {
  name: string;
  path: string;
  text: string;
  base?: string;
  lines: number;
  /** every field and method name, so a new one never takes a used name */
  members: Set<string>;
  methods: IndexedMethod[];
}

const CLASS = /^export class (\w+)(?:\s+extends\s+(\w+))?/m;
const CONST = /^const\s+(\w+)\s*=\s*(.+);\s*$/;
const FIELD = /^\s+(?:(?:private|protected|public|readonly)\s+)*(\w+)\s*=\s*((?:Appium)?By\.\w+\(.*\));\s*$/;
const LOCATOR_METHOD = /^\s+(?:(?:private|protected)\s+)?(\w+)\((\w+): string\): string \{\s*$/;
const METHOD = /^ {2}(?:public\s+)?async\s+(\w+)\(([^)]*)\)\s*:\s*Promise<.*>\s*\{\s*$/;
const MEMBER = /^ {2}(?:(?:private|protected|public|static|readonly|async)\s+)*(\w+)\s*[(=:<]/;
const ACTION = /this\.(click|type|tap)\(\s*this\.(\w+)(\()?/g;
const CALL = /this\.api\.call\(\s*'([A-Z]+ [^']+)'/;

export function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

/** the element keys of the class: fields (By... = key) and row locator methods (name(row) => key with {row}) */
function locators(lines: string[]): { fields: Map<string, string>; rows: Map<string, string> } {
  const consts = new Map<string, string>();
  const fields = new Map<string, string>();
  const rows = new Map<string, string>();
  lines.forEach((l, i) => {
    const c = CONST.exec(l);
    if (c) {
      const text = textOf(c[2], consts);
      if (text !== undefined) consts.set(c[1], text);
    }
    const f = FIELD.exec(l);
    const fk = f ? locatorKey(f[2], consts) : undefined;
    if (f && fk) fields.set(f[1], fk);
    const m = LOCATOR_METHOD.exec(l);
    const ret = m ? /^\s*return\s+(.+);\s*$/.exec(lines[i + 1] ?? '') : null;
    const rk = m && ret ? locatorKey(ret[1], consts, m[2]) : undefined;
    if (m && rk) rows.set(m[1], rk);
  });
  return { fields, rows };
}

function method(name: string, params: string, body: string, loc: ReturnType<typeof locators>): IndexedMethod {
  const count = params.trim() ? params.split(',').length : 0;
  const acts = [...body.matchAll(ACTION)];
  const out: IndexedMethod = { name, params: count, body, endpoint: CALL.exec(body)?.[1] };
  if (acts.length !== 1) return out;
  const [, action, field, call] = acts[0];
  const key = call ? loc.rows.get(field) : loc.fields.get(field);
  return key ? { ...out, action, key, row: !!call } : out;
}

/** a class file read: its name, size, members, and what each public method does */
export function indexClass(file: CodeFile): IndexedClass | undefined {
  const head = CLASS.exec(file.text);
  if (!head) return undefined;
  const lines = file.text.split(/\r?\n/);
  const loc = locators(lines);
  const methods: IndexedMethod[] = [];
  const members = new Set<string>();
  lines.forEach((l, i) => {
    const name = MEMBER.exec(l)?.[1];
    if (name) members.add(name);
    const m = METHOD.exec(l);
    if (!m) return;
    const end = lines.findIndex((x, j) => j > i && /^ {2}}\s*$/.test(x));
    methods.push(method(m[1], m[2], lines.slice(i + 1, end < 0 ? lines.length : end).join('\n'), loc));
  });
  return { name: head[1], base: head[2], path: file.path, text: file.text, lines: lines.length, members, methods };
}

export function indexCode(code: CodeFile[]): IndexedClass[] {
  return code.map(indexClass).filter((c): c is IndexedClass => c !== undefined);
}
