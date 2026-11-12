import { idKey, idValue, recordName } from './recordName';
import { RecordNames, recordNames } from './recordNames';
import { MASK, secretField, SecretValues, secretValues } from './secretValues';

/** a call that only reads (it stays in Network, never a step) */
const READ = /^(get|search|list|find|check|download|read|is|has|count|export|load|validate)/i;
/** a last part that is only a verb: the thing it acts on is the part before it ("WorkPlan/Delete" = Delete work plan) */
const BARE_VERB = /^(create|add|delete|remove|update|edit|save|approve|reject|cancel|register)$/i;
/** a call that adds a record: the id it answers is the new record's */
const MAKES = /^(add|create|new|insert|register|save)/i;
const MAX_VALUES = 4;
const MAX_LENGTH = 40;

/** "AddUser" -> "Add user", "id" -> "id" */
function words(name: string): string {
  const parts = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : p.toLowerCase())).join(' ');
}

function actionOf(path: string[]): string {
  const last = path[path.length - 1] ?? '';
  const before = path[path.length - 2] ?? '';
  if (BARE_VERB.test(last) && before && !/^api$/i.test(before)) return `${words(last)} ${words(before).toLowerCase()}`;
  return words(last);
}

/** the body's own values (Availo's {Data: ...} envelope opened), then the address's query values */
function sentValues(url: URL, body: string | undefined): [string, unknown][] {
  let fields: [string, unknown][] = [];
  try {
    const o = JSON.parse(body ?? '') as Record<string, unknown>;
    const data = o && typeof o.Data === 'object' && o.Data !== null && !Array.isArray(o.Data) ? o.Data as Record<string, unknown> : o;
    if (data && typeof data === 'object' && !Array.isArray(data)) fields = Object.entries(data);
  } catch {
    // not JSON: the query only
  }
  return [...fields, ...url.searchParams.entries()];
}

function shown(key: string, value: string, secrets: SecretValues): string {
  if (secretField(key)) {
    secrets.keep(value);
    return `${words(key)} "${MASK}"`;
  }
  return `${words(key)} "${value.length > MAX_LENGTH ? `${value.slice(0, MAX_LENGTH)}…` : value}"`;
}

/** the address's last part, or '' when it is no address */
function lastPart(address: string): string {
  try {
    return new URL(address).pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return '';
  }
}

/** the call adds a record (Add user, WorkPlan/Create): what it answers names that record */
export function makesRecord(method: string, address: string): boolean {
  return !/^(GET|HEAD|OPTIONS)$/i.test(method) && MAKES.test(lastPart(address));
}

/** the record the call is about, in plain words: the name it sent, else the name of the id it sent (run 642) */
function recordOf(sent: [string, unknown][], names: RecordNames): { name: string; keys: string[] } | undefined {
  const own = recordName(Object.fromEntries(sent), false);
  if (own) return own;
  for (const [k, v] of sent) {
    const name = idKey(k) || idValue(String(v)) ? names.nameOf(String(v), k) : undefined;
    if (name) return { name, keys: [k] };
  }
  return undefined;
}

/**
 * The step line of a call the test made by API (Omar, run 633; Test 8094 run 642): what it did, the record by its plain
 * name, the main values it sent - Add user "Ali Test" - Job number "xyz" (by API); a secret as ***; never an id (it stays
 * in Network). A read (get, search, list ...) is no step: it stays in Network.
 */
export function apiStep(method: string, address: string, body: string | undefined, secrets: SecretValues = secretValues,
  names: RecordNames = recordNames): { a: 'api'; e: string } | null {
  if (/^(GET|HEAD|OPTIONS)$/i.test(method)) return null;
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  const path = url.pathname.split('/').filter(Boolean);
  const last = path[path.length - 1] ?? '';
  if (!last || READ.test(last)) return null;
  const sent = sentValues(url, body).filter(([, v]) => (typeof v === 'string' && v !== '') || typeof v === 'number');
  const record = recordOf(sent, names);
  const values = sent
    .filter(([k, v]) => !idKey(k) && !idValue(String(v)) && !record?.keys.includes(k))
    .slice(0, MAX_VALUES)
    .map(([k, v]) => shown(k, String(v), secrets));
  const named = record ? `${actionOf(path)} "${record.name}"` : actionOf(path);
  return { a: 'api', e: `${named}${values.length ? ` - ${values.join(', ')}` : ''} (by API)` };
}
