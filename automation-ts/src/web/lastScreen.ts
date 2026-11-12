import { Page } from '@playwright/test';
import { FACTS, LAST_SCREEN } from '../report/failureFacts';
import { factsLine, menuTexts } from './pageFacts';
import { onStandIn } from './signin/standIn';

type Attach = (name: string, attachment: { body: string | Buffer; contentType: string }) => Promise<void>;

/**
 * The end of every web test, as base.BaseTests keeps it: its last screen, passed or failed (it goes with the run's
 * report); for a failure the page's address and menu texts first. A browser that cannot give a picture leaves the facts.
 */
export async function keepTestEnd(page: Page, attach: Attach, failed: boolean, limitMs = 10_000): Promise<void> {
  const standIn = onStandIn(page.url()); // Trova's own sign-in stand-in: no address, no picture of it
  if (failed) {
    // run 688: an app whose own script hung never answered a read - each read of the page has a limit
    const menu = await within(menuTexts(page), limitMs);
    const where = standIn ? 'before the app opened' : page.url();
    const line = menu === undefined ? `${factsLine(where, [])} - the page did not answer within ${limitMs / 1000} s (its own script was busy)`
      : factsLine(where, menu);
    await attach(FACTS, { body: line, contentType: 'text/plain' });
  }
  if (standIn) return;
  const shot = await page.screenshot({ fullPage: false, timeout: limitMs }).catch(() => undefined);
  if (shot) await attach(LAST_SCREEN, { body: shot, contentType: 'image/png' });
}

/** the read's answer, or undefined when the page did not give it within ms */
function within<T>(read: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<undefined>((done) => { timer = setTimeout(() => done(undefined), ms); });
  return Promise.race([read.catch(() => undefined), late]).finally(() => clearTimeout(timer));
}
