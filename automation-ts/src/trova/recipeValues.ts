import { randomUUID } from 'node:crypto';
import { Json, JsonObject } from './json';

/**
 * The pieces of a sign-in recipe (Test Data -> Programmatically) - nothing here knows the app; the TS twin of
 * utils.ApiSignInRecipe. Placeholders: {{login:Field|Other name>transform}}, {{keep:name.path}}, {{new:id}}.
 * A whole-string placeholder keeps the JSON shape of its value.
 */
const PLACE = /\{\{(login|keep|new):([^}>]+)(?:>([^}]+))?}}/;
const PLACES = new RegExp(PLACE.source, 'g');

export type FieldReader = (names: string) => string;

/** the login's value of the first of names ("Password|كلمة المرور") that it has, case and outer spaces ignored */
export function loginField(fields: Record<string, string>, names: string): string | undefined {
  for (const name of names.split('|')) {
    const key = Object.keys(fields).find((k) => k.trim().toLowerCase() === name.trim().toLowerCase());
    if (key !== undefined) return fields[key];
  }
  return undefined;
}

/** a copy of template with every placeholder filled */
export function fill(template: Json | undefined, field: FieldReader, kept: JsonObject, transforms: JsonObject): Json {
  if (template === undefined || template === null) return null;
  if (Array.isArray(template)) return template.map((t) => fill(t, field, kept, transforms));
  if (typeof template === 'object') {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(template)) out[k] = fill(v, field, kept, transforms);
    return out;
  }
  if (typeof template !== 'string') return template;
  const whole = new RegExp(`^${PLACE.source}$`).exec(template);
  if (whole) return value(whole, field, kept, transforms);
  return template.replace(PLACES, (...m: string[]) => plain(value(m as unknown as RegExpExecArray, field, kept, transforms)));
}

/** a value as text: a string as it is, anything else as its JSON */
export function plain(v: Json | undefined): string {
  if (v === undefined || v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** the part of root at a dotted path ("Data.ID"; "" = all of it), or undefined */
export function at(root: Json | undefined, path: string): Json | undefined {
  if (!path || path === '.') return root;
  let node: Json | undefined = root;
  for (const part of path.split('.')) {
    if (node === null || node === undefined || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return node;
}

/** true when the value is there and not empty */
export function present(v: Json | undefined): boolean {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

/** "char-offsets": each character shifted by its offset (the later ones by "rest") */
export function transform(value: string, t: Json | undefined): string {
  if (t === null || typeof t !== 'object' || Array.isArray(t) || t.kind !== 'char-offsets') return value;
  const offsets = Array.isArray(t.offsets) ? t.offsets.map(Number) : [];
  const rest = Number(t.rest ?? 0);
  return [...value].map((ch, i) => String.fromCharCode(ch.charCodeAt(0) + (i < offsets.length ? offsets[i] : rest))).join('');
}

function value(m: RegExpExecArray, field: FieldReader, kept: JsonObject, transforms: JsonObject): Json {
  const [, kind, name, transformName] = m;
  if (kind === 'new') return randomUUID();
  if (kind === 'login') {
    const v = field(name);
    return transformName && transforms[transformName] ? transform(v, transforms[transformName]) : v;
  }
  const path = name.trim();
  const dot = path.indexOf('.');
  const root = kept[dot < 0 ? path : path.slice(0, dot)];
  const v = dot < 0 ? root : at(root, path.slice(dot + 1));
  return v === undefined || v === null ? '' : v;
}
