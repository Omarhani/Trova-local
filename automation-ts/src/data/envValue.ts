/**
 * A suite value that may differ per environment: "Test=Home; Stage=hany" gives "Home" on Test and "hany" on Stage (names
 * in any letter case); a value with no "env=" part is the same for every environment. A per-environment value that names
 * no value for env stops with a plain error (never a guess).
 */
export function valueForEnv(text: string, env: string): string {
  const parts = text.split(';').map((p) => p.trim()).filter(Boolean);
  const named = parts.filter((p) => /^[^=]+=/.test(p));
  if (named.length === 0) return text.trim();
  const want = env.trim().toLowerCase();
  const hit = named.find((p) => p.slice(0, p.indexOf('=')).trim().toLowerCase() === want);
  if (!hit) {
    const has = named.map((p) => p.slice(0, p.indexOf('=')).trim()).join(', ');
    throw new Error(`The suite has no value for the ${env} environment in "${text.trim()}" (it names ${has})`);
  }
  return hit.slice(hit.indexOf('=') + 1).trim();
}
