import { asObject, asText, JsonObject } from '../trova/json';
import { BrowserValues } from './browserSignIn';
import { tokensIn } from './jwtValues';

const PLACES = ['localStorage', 'sessionStorage', 'cookies'] as const;

/**
 * The token the app's API takes, from a saved browser state: the value under the sign-in recipe's token key (Availo:
 * localStorage TOKEN, stored as JSON - its quotes taken off), else the first token found in the values; '' when none.
 */
export function tokenOf(browser: BrowserValues, recipe: JsonObject | undefined): string {
  const byKey = recipeKey(recipe);
  const raw = byKey ? browser[byKey.place]?.[byKey.key] : undefined;
  if (raw) return unquoted(raw);
  for (const place of PLACES) {
    for (const value of Object.values(browser[place])) {
      const found = tokensIn(value)[0];
      if (found) return found.token;
    }
  }
  return '';
}

/** where the recipe puts its token in the browser: the browser entry filled from the recipe's "token" */
function recipeKey(recipe: JsonObject | undefined): { place: keyof BrowserValues; key: string } | undefined {
  const name = asText(recipe?.token);
  const entries = Array.isArray(recipe?.browser) ? recipe.browser.map(asObject) : [];
  const entry = name ? entries.find((e) => asText(e.from) === name) : undefined;
  const place = asText(entry?.place);
  return entry && (PLACES as readonly string[]).includes(place) ? { place: place as keyof BrowserValues, key: asText(entry.key) } : undefined;
}

function unquoted(value: string): string {
  if (!value.startsWith('"')) return value;
  try {
    const v = JSON.parse(value) as unknown;
    return typeof v === 'string' ? v : value;
  } catch {
    return value;
  }
}
