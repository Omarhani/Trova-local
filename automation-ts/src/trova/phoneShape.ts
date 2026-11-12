import { randomUUID } from 'node:crypto';
import { asObject, asText, Json, JsonObject } from './json';

/**
 * How the phone app shapes every call (the phone recipe's "callShape", learned by Trova): its own headers and the
 * envelope a payload goes in ({UserID: "{{signIn:USER_ID}}", RequestId: "{{new:id}}", Data: "{{data}}"}).
 */
export interface PhoneShape {
  headers: Record<string, string>;
  envelope?: JsonObject;
}

/** the recipe's call shape with "{{signIn:KEY}}" filled from the sign-in's kept values */
export function shapeOf(recipe: JsonObject, kept: Record<string, string>): PhoneShape {
  const shape = asObject(recipe.callShape);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(asObject(shape.headers))) headers[k] = asText(v);
  if (!shape.envelope) return { headers };
  const envelope: JsonObject = {};
  for (const [k, v] of Object.entries(asObject(shape.envelope))) {
    const m = typeof v === 'string' ? /^\{\{signIn:(.+)}}$/.exec(v) : null;
    envelope[k] = m ? kept[m[1]] ?? null : v;
  }
  return { headers, envelope };
}

/** the payload in the phone app's envelope; a body that already has "Data" goes as it is */
export function wrap(shape: PhoneShape, body: Json): Json {
  if (!shape.envelope || body === null || typeof body !== 'object' || Array.isArray(body)) return body;
  if ('Data' in body || 'data' in body) return body;
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(shape.envelope)) {
    out[k] = v === '{{data}}' ? body : v === '{{new:id}}' ? randomUUID() : v;
  }
  return out;
}
