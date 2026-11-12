import { Page } from '@playwright/test';
import { asText, JsonObject } from '../../trova/json';
import { clickStep, typeStep } from './signInAct';
import { dialogButton, family, findNow, midSignIn, pageSays, pickBox, signedInNow } from './signInPage';
import { appName, refusalWords } from './signInRefusal';
import { signOutSigns } from './signOutSigns';

type Step = { fill?: string; field?: string; click?: string; wait?: number };

/** what a healed run gives back: the steps with a box or button found again (kept for the next runs) */
export interface ScreenSignInResult {
  healed: JsonObject | undefined;
}

/**
 * One sign-in on the screen with the login's saved steps (learned by the AI agent: {url, steps: [{fill, field} |
 * {click} | {wait}], done}), the values from Test Data → Credentials - the TS twin of utils.ScreenSignIn. Each step
 * finds its element again right before it acts; a box or button that is gone is found again by its kind (the code box
 * in the open dialog, the dialog's confirm button). Throws in plain words with the app's own reason. Never logs a value.
 */
export async function screenSignIn(page: Page, url: string, login: string, recipe: JsonObject,
                                   fields: Record<string, string>, stop?: AbortSignal): Promise<ScreenSignInResult> {
  const started = Date.now();
  const app = appName(url);
  try {
    return await runSteps(page, url, login, JSON.parse(JSON.stringify(recipe)) as JsonObject, fields, started, stop);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/^(Signing in as|The login|\S+ refused:|\S+ did not let|The sign-in did not get through)/.test(msg)) throw e;
    const says = await said(page, started);
    throw new Error(says ? refusalWords(app, says, false, () => true)
      : `${app} did not let the sign-in through: ${msg}`);
  }
}

async function runSteps(page: Page, url: string, login: string, recipe: JsonObject, fields: Record<string, string>,
                        started: number, stop?: AbortSignal): Promise<ScreenSignInResult> {
  const start = asText(recipe.url).trim() || url;
  const done = asText(recipe.done);
  const steps = (Array.isArray(recipe.steps) ? recipe.steps : []) as Step[];
  let healed = false;
  await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  for (let i = 0; i < steps.length; i++) {
    if (stop?.aborted) throw new Error('The sign-in was stopped');
    const step = steps[i];
    if (step.wait !== undefined) { await waitForNext(page, steps, i, Math.min(Number(step.wait) || 0, 10_000), done, start); continue; }
    const selector = step.fill ?? step.click;
    if (!selector) continue;
    let el = await findNow(page, selector, 8000);
    const fix = el ? 'ok' : await heal(page, step, steps, i);
    if (!fix && (await signedInNow(page, done, start)) === null) break; // the page moved on: already in
    if (!fix) {
      const says = await said(page, started);
      if (says) throw new Error(refusalWords(appName(url), says, false, () => true));
      throw new Error(`Signing in as "${login}" on the screen stopped: the page has no ${selector} any more - run an AI session that signs in as ${login} once, so Trova learns the new sign-in page`);
    }
    if (fix === 'skip') continue;
    if (!el) healed = true;
    const now = (step.fill ?? step.click)!;
    el ??= await findNow(page, now, 2000);
    if (step.click !== undefined) { await clickStep(page, now, el); continue; }
    await typeStep(page, now, el, valueOf(fields, login, step.field ?? ''));
    if (fix === 'submit') await pressDialogButton(page);
  }
  return finish(page, url, recipe, done, start, healed, started, stop);
}

/** waits (up to 20 s) until the page is signed in; stops early when the app has said no on its sign-in page */
async function finish(page: Page, url: string, recipe: JsonObject, done: string, start: string, healed: boolean,
                      started: number, stop?: AbortSignal): Promise<ScreenSignInResult> {
  let saidSince = 0;
  for (const until = Date.now() + 20_000; Date.now() < until && !stop?.aborted; await page.waitForTimeout(400)) {
    if ((await signedInNow(page, done, start)) === null) return { healed: healed ? recipe : undefined };
    const says = await pageSays(page);
    saidSince = says ? saidSince || Date.now() : 0;
    if (saidSince && Date.now() - saidSince >= 1200) break; // the app's answer stays on its sign-in page
  }
  const says = await said(page, started);
  const where = await signedInNow(page, done, start);
  if (!says && where) throw new Error(`${appName(url)} did not let the sign-in through: ${where}`);
  throw new Error(refusalWords(appName(url), says, false, () => true));
}

/** the login's value for a field (its name, case ignored); a missing one said plainly */
function valueOf(fields: Record<string, string>, login: string, field: string): string {
  const hit = Object.entries(fields).find(([k, v]) => k.toLowerCase() === field.toLowerCase() && v?.trim());
  if (hit) return hit[1];
  if (family(field) === 'otp') {
    throw new Error(`Signing in as "${login}" needs a one-time code, and Trova has no fixed code for this login - add a fixed code (${field}) in Test Data → Credentials, so Trova can sign in again by itself when the sign-in runs out`);
  }
  throw new Error(`The login "${login}" has no ${field} - add it in Test Data → Credentials`);
}

/** 'healed' (step changed), 'submit' (healed box, then the dialog's button), 'skip' (a click left over), or null */
async function heal(page: Page, step: Step, steps: Step[], at: number): Promise<string | null> {
  if (step.fill !== undefined) {
    const alt = await pickBox(page, step.field ?? '');
    if (!alt) return null;
    step.fill = join(alt, step.fill);
    const next = steps.slice(at + 1).find((s) => s.fill !== undefined || s.click !== undefined);
    return next?.click !== undefined ? 'healed' : 'submit';
  }
  const text = await dialogButton(page, false);
  if (text) { step.click = join(`text=${text}`, step.click ?? ''); return 'healed'; }
  return (await midSignIn(page)) ? null : 'skip';
}

/** a healed code box: its dialog's confirm button, pressed once it is there (3 s at most) */
async function pressDialogButton(page: Page): Promise<void> {
  for (const until = Date.now() + 3000; Date.now() < until; await page.waitForTimeout(200)) {
    if (await dialogButton(page, true)) return;
  }
}

/** "new, old" - the finder takes the first that is there, so both pages keep working */
function join(alt: string, old: string): string {
  if (!old.trim() || old === '[data-fia-none]') return alt;
  return old.split(',').some((o) => o.trim() === alt) ? old : `${alt}, ${old}`;
}

/** what the app says on the page, else what its API answered when it refused a call since the sign-in began */
async function said(page: Page, started: number): Promise<string> {
  return (await pageSays(page)) || signOutSigns.lastRefusal(started);
}

/** a learned "wait" step: up to ms until the next box / button is there, or the page is signed in */
async function waitForNext(page: Page, steps: Step[], at: number, ms: number, done: string, start: string): Promise<void> {
  const next = steps.slice(at + 1).map((s) => s.fill ?? s.click).find((s) => s);
  for (const until = Date.now() + ms; Date.now() < until; await page.waitForTimeout(300)) {
    const there = next ? await findNow(page, next, 0) : null;
    if (there) { await there.dispose(); return; }
    if ((await signedInNow(page, done, start)) === null) return;
  }
}
