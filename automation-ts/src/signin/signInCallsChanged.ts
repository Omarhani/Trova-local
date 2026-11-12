const GONE = /(\S+) answered HTTP (404|405|410)\b/;
const NOT_JSON = /Unexpected token|JSON at position|is not valid JSON|Unexpected end of JSON/i;
const NO_TOKEN = /gave no token/i;
const CHANGED = "The app's sign-in calls changed - learn again";

/**
 * An API sign-in that failed because the app's sign-in calls are not what Trova learned any more (a call gone, an
 * answer that is not its JSON, no token in it): the plain reason, else undefined (a refusal in the app's own words).
 */
export function callsChanged(message: string): string | undefined {
  const gone = GONE.exec(message);
  if (gone) return `${CHANGED} (${gone[1]} gave HTTP ${gone[2]})`;
  if (NOT_JSON.test(message)) return `${CHANGED} (its answer is not what it was)`;
  if (NO_TOKEN.test(message)) return `${CHANGED} (its answer has no token any more)`;
  return undefined;
}
