/** the leave requests a run sent, kept as "<employee user name>|<note>" - the clean-up finds them per employee */

export function leaveNoteKey(userName: string, note: string): string {
  return `${userName}|${note}`;
}

/** the kept keys grouped by employee, in the order kept; a key with no employee part is left out */
export function notesByEmployee(keys: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const key of keys) {
    const at = key.indexOf('|');
    if (at <= 0) continue;
    const userName = key.slice(0, at);
    out.set(userName, [...(out.get(userName) ?? []), key.slice(at + 1)]);
  }
  return out;
}
