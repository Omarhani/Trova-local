import { KnowledgePick } from './madeRun';

/** the page's name in the App map for an address in the app ("/holidays" -> "Public holidays page"), when it has one */
export type PageNamer = (page: string) => string | undefined;

const OPEN = /open `([^`]+)`/g;

/** the address as a path to compare: "/holidays/", "https://app.x/holidays?x=1" and "/Holidays" are the same page */
function pathOf(address: string): string {
  let path = address.trim();
  try {
    path = new URL(path, 'http://app.invalid').pathname;
  } catch {
    // not an address - compared as written
  }
  return (path.replace(/\/+$/, '') || '/').toLowerCase();
}

/**
 * Hand-over 2026-11-14: the App map pages Trova picked for the case name the page classes the maker adds - a page the
 * App map knows by the address the AI opened gets the App map's name; any other page keeps its name from the address.
 */
export function appMapNamer(picks: KnowledgePick[] = []): PageNamer {
  const named = new Map<string, string>();
  for (const k of picks) {
    if (k.kind !== 'page' || !k.name?.trim()) continue;
    for (const m of (k.text ?? '').matchAll(OPEN)) if (!named.has(pathOf(m[1]))) named.set(pathOf(m[1]), k.name.trim());
  }
  return (page) => named.get(pathOf(page));
}
