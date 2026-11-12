/** a key that holds an id: Id, id, ID, UserId, user_id, userID (never "Paid") */
export function idKey(key: string): boolean {
  return /^id$|Id$|ID$|_id$/.test(key);
}

/** a value that looks like an id: a GUID or a long code */
export function idValue(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{24,}$/i.test(value);
}

/** the name keys, best first; a pair is joined ("Ali" + "Test" = "Ali Test") */
const NAMES: string[][] = [['fullname'], ['firstname', 'lastname'], ['name'], ['nameen'], ['englishname'], ['namear'], ['arabicname'], ['title']];
/** "...Name" keys that name something else than the record itself */
const NOT_ITS_NAME = /^(user|file|first|last|middle|role|department|branch|company|status|type|class|host)name$/;

export interface FoundName { name: string; keys: string[] }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The plain name of one record (an answer's row or the body sent): its full name, first + last name, name, title, a
 * "...Name" of its own - and, for a row read back (userName = true), its user name last. undefined when it has none.
 */
export function recordName(o: Record<string, unknown>, userName: boolean): FoundName | undefined {
  const byLower = new Map(Object.keys(o).map((k) => [k.toLowerCase(), k]));
  const lists = [...NAMES, ...[...byLower.keys()].filter((k) => k.endsWith('name') && k !== 'name' && !NOT_ITS_NAME.test(k)).map((k) => [k])];
  if (userName) lists.push(['username']);
  for (const list of lists) {
    const keys = list.map((l) => byLower.get(l)).filter((k): k is string => k !== undefined && text(o[k]) !== '');
    if (keys.length === list.length || (list.length > 1 && keys.length > 0)) return { name: keys.map((k) => text(o[k])).join(' '), keys };
  }
  return undefined;
}
