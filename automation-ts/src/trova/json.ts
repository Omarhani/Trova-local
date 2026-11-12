/** JSON as Trova's rules read it - plain data, no file. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export function asObject(value: Json | undefined): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** a value as text: a string as it is, anything else as its JSON; "" for none */
export function asText(value: Json | undefined): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
}
