import { idKey, recordName } from './recordName';

type Obj = Record<string, unknown>;
interface Known { key: string; name: string }

const MAX_NODES = 20_000;

function parsed(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? '');
  } catch {
    return undefined;
  }
}

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function scalar(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

/** Availo's {Data: ...} envelope opened */
function opened(v: unknown): unknown {
  return isObj(v) && 'Data' in v ? v.Data : v;
}

/**
 * Test 8094 run 642: the plain name of each record the run made or read by API, by its id - so a later API step says
 * 'Delete user "Ali Test"' and never shows the id (ids stay in Network only). One per test process.
 */
export class RecordNames {
  private readonly known = new Map<string, Known[]>();

  /**
   * what one call sent and what the app answered: every row with an id and a name; made = the call adds a record, so a
   * bare id it answered is the new record's (an update's "1" is not)
   */
  learn(sent?: string, answer?: string, made = false): void {
    const body = opened(parsed(sent));
    const reply = parsed(answer);
    this.walk(body);
    this.walk(reply);
    const named = made && isObj(body) ? recordName(body, false) : undefined;
    const newId = named ? this.newIdOf(opened(reply)) : '';
    if (named && newId) this.keep(newId, 'id', named.name);
  }

  /** the name of the record with this id; key = the name the id was sent under (UserId), the same key first */
  nameOf(id: string, key = ''): string | undefined {
    const all = this.known.get(id.trim()) ?? [];
    const want = key.toLowerCase();
    const pick = all.find((k) => k.key === want) ?? all.find((k) => k.key === 'id') ?? (want === '' || want === 'id' ? all[0] : undefined);
    return pick?.name;
  }

  private walk(start: unknown): void {
    const todo: unknown[] = [start];
    for (let seen = 0; todo.length && seen < MAX_NODES; seen++) {
      const v = todo.pop();
      if (Array.isArray(v)) todo.push(...v);
      else if (isObj(v)) {
        this.row(v);
        todo.push(...Object.values(v));
      }
    }
  }

  /** one row: its own id (Id first, else the only id it has) with its name */
  private row(o: Obj): void {
    const found = recordName(o, true);
    if (!found) return;
    const ids = Object.keys(o).filter((k) => idKey(k) && scalar(o[k]) !== '');
    const own = ids.find((k) => k.toLowerCase() === 'id') ?? (ids.length === 1 ? ids[0] : undefined);
    if (own) this.keep(scalar(o[own]), own, found.name);
  }

  /** the id the app gave back for a record it made: Data = 42, or an object with its id and no name */
  private newIdOf(reply: unknown): string {
    if (scalar(reply) !== '' && typeof reply !== 'boolean') return scalar(reply);
    if (!isObj(reply)) return '';
    const key = Object.keys(reply).find((k) => idKey(k) && scalar(reply[k]) !== '');
    return key ? scalar(reply[key]) : '';
  }

  private keep(id: string, key: string, name: string): void {
    const list = this.known.get(id) ?? [];
    const k = key.toLowerCase();
    this.known.set(id, [...list.filter((e) => e.key !== k), { key: k, name }]);
  }
}

/** the run's one record of names (one per test process) */
export const recordNames = new RecordNames();
