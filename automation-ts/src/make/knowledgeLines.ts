import { KnowledgePick } from './madeRun';

type BusinessKind = Exclude<KnowledgePick['kind'], 'page'>;

/** how each kind of business pick reads in the picture; a kind not listed here is left out */
const BUSINESS: Record<BusinessKind, (k: KnowledgePick) => string> = {
  rule: (k) => `Business rule: ${k.text}`,
  entity: (k) => `Business record: ${k.name} - ${k.text}`,
  actor: (k) => `Business actor: ${k.name} - ${k.text}`,
};

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function businessLine(k: KnowledgePick): string | undefined {
  const write = BUSINESS[k.kind as BusinessKind];
  if (!write || !k.text?.trim()) return undefined;
  return oneLine(`${write(k)}${k.source?.trim() ? ` (from ${k.source})` : ''}`);
}

/**
 * Hand-over 2026-11-14: the knowledge Trova picked for the case, in the picture the tester reads and the test opens with -
 * the business rules, records and actors it follows (each with where it comes from), and the App map pages by their plain
 * names (never an address).
 */
export function knowledgeLines(picks: KnowledgePick[] = []): string[] {
  const business = picks.map(businessLine).filter((l): l is string => !!l);
  const pages = [...new Set(picks.filter((k) => k.kind === 'page' && k.name?.trim()).map((k) => oneLine(k.name)))];
  return pages.length ? [...business, `App map: ${pages.join(', ')}`] : business;
}
