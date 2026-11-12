/** close glyphs at either end only ("2 × 3" stays) */
const GLYPHS = /^[\s×✕✖✗]+|[\s×✕✖✗]+$/g;

/**
 * A message as a person reads it - the TS twin of utils.UiText.withoutClose: "Saved successfully×" /
 * "Saved successfully\n✕" become "Saved successfully"; spaces made single, ends trimmed.
 */
export function withoutClose(text: string): string {
  let t = text.replace(GLYPHS, '').replace(/\s+/g, ' ').trim();
  if (t.length > 2 && (t.endsWith(' x') || t.endsWith(' X'))) t = t.slice(0, -2).trim();
  return t;
}
