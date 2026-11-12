export type Row = Record<string, unknown>;

/** the rows of a list answer (Data.List); empty when it has none */
export function listOf(answer: unknown): Row[] {
  const list = (answer as { Data?: { List?: unknown } } | undefined)?.Data?.List;
  return Array.isArray(list) ? (list as Row[]) : [];
}

/** the row of exactly this user name, any letter case (the app keeps user names in lower case) */
export function byUserName(rows: Row[], userName: string): Row | undefined {
  const want = userName.trim().toLowerCase();
  return rows.find((r) => String(r.UserName ?? '').trim().toLowerCase() === want);
}
