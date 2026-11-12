import * as fs from 'node:fs';
import * as path from 'node:path';
import { Page } from '@playwright/test';
import { Json, JsonObject } from '../../run/runDataFile';
import { recipeFor } from '../../signin/signIns';
import { asIfMissing, keepPageKeys, pageSettingsKnown } from './keptSignIn';
import { PageSettings, readPageSettings } from './pageSettingsCapture';

/** read once per run and login - a file, because the blocks run in worker processes one after another */
function memo(login: string): string {
  const run = process.env.TROVA_RUN_ID?.trim() || 'local';
  return path.resolve(__dirname, '..', '..', '..', 'target', `page-settings-${run}-${login.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

/**
 * The sign-in page's settings for a login whose API recipe has none (Java PageSettingsCapture.orRead): read ONCE per run
 * and login, used at once as set-if-missing, and left for the runner to add to the recipe so the next runs need no
 * extra visit. A recipe that has them (or was read already) costs nothing.
 */
export async function pageSettingsFor(page: Page, web: string, login: string): Promise<Json[]> {
  let recipe: JsonObject | undefined;
  try { recipe = recipeFor(login, 'web'); } catch { recipe = undefined; }
  if (pageSettingsKnown(recipe)) return [];
  const file = memo(login);
  if (fs.existsSync(file)) return asIfMissing(JSON.parse(fs.readFileSync(file, 'utf8')) as PageSettings);
  let keys: PageSettings = {};
  try {
    keys = await readPageSettings(page, web);
    keepPageKeys(login, keys);
    const n = Object.values(keys).reduce((sum, kv) => sum + Object.keys(kv ?? {}).length, 0);
    console.log(`Read the page settings of the sign-in page once for ${login}${n ? ` (${n}) - kept for the next runs` : ' - it writes none'}`);
  } catch {
    console.log('The page settings of the sign-in page could not be read this time - the run goes on');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys), 'utf8');
  return asIfMissing(keys);
}
