import type { Page } from '@playwright/test';

/** run 762: the house's longest wait - the app's leave page is busy 20+ s on its first load and is alive */
export const FROZEN_LIMIT_MS = 60_000;

/** the case's reason when its page froze - plain words, read by failureKind as a set-up problem (BLOCKED) */
export const FROZEN = 'The page stopped answering for 60 s (its own script was busy) - the case could not be checked';

/**
 * Run 747 (Omar 2026-11-11): the app's page froze after a Save and the case waited its whole 5 minutes. The page is asked
 * a trivial question every everyMs; ONE question left with no reply at all for limitMs (60 s) = frozen: the page is closed with
 * FROZEN, so the case ends at once. Any reply - an error while it loads a new page included (runs 750 / 752) - is alive.
 * Gives back the stop.
 */
export function watchFrozen(page: Pick<Page, 'evaluate' | 'close'>, o = { everyMs: 5_000, limitMs: FROZEN_LIMIT_MS }): () => void {
  let askedAt = 0; // when the question still waiting was asked; 0 = none waiting
  let done = false;
  const look = setInterval(() => {
    if (done) return;
    if (askedAt && Date.now() - askedAt >= o.limitMs) {
      done = true;
      clearInterval(look);
      void page.close({ reason: FROZEN, runBeforeUnload: false }).catch(() => undefined);
      return;
    }
    if (askedAt) return;
    askedAt = Date.now();
    page.evaluate(() => 1).then(() => undefined, () => undefined).finally(() => { askedAt = 0; });
  }, o.everyMs);
  return () => { done = true; clearInterval(look); };
}

/**
 * run 755: the page answers one trivial question within ms (an error while it loads is an answer too). Run 790: a page
 * the watch already closed (it froze) is not answering - its error says it is closed
 */
export function answersWithin(page: Pick<Page, 'evaluate'>, ms: number): Promise<boolean> {
  return new Promise((answer) => {
    const limit = setTimeout(() => answer(false), ms);
    const done = (alive: boolean): void => { clearTimeout(limit); answer(alive); };
    page.evaluate(() => 1).then(() => done(true), (e: unknown) => done(!/has been closed/i.test(String(e))));
  });
}
