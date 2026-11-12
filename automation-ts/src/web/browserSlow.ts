/** the words a slow browser answers with */
export const SLOW = 'The browser was slow';

/** a page that did not load in time - never an element that did not show (that is the app, not the browser) */
const SLOW_WORDS = [/Timed out receiving message from renderer/, /timeout: Timed out/, /cannot determine loading status/,
  /Read timed out/, /Navigation timeout of/, /page\.(goto|reload|goBack|goForward|waitForNavigation): Timeout/, /net::ERR_TIMED_OUT/];

/** true when e (or a cause) is the browser timing out, not the app refusing anything (utils.BrowserSlow.is) */
export function isSlow(e: unknown): boolean {
  for (let t: unknown = e, depth = 0; t instanceof Error && depth < 10; t = t.cause, depth += 1) {
    if (SLOW_WORDS.some((w) => w.test(t instanceof Error ? t.message : ''))) return true;
  }
  return false;
}

/**
 * Runs step; a slow browser is said once and the step tried once more; a second slow answer fails this step only with a
 * plain slow reason - never a refused sign-in (utils.BrowserSlow.retryOnce). beforeRetry runs between the two tries.
 */
export async function retryOnce<T>(step: () => Promise<T>, say: (line: string) => void = console.log,
                                   beforeRetry: () => Promise<void> = async () => undefined): Promise<T> {
  try {
    return await step();
  } catch (e) {
    if (!isSlow(e)) throw e;
    say(`${SLOW} - retried once`);
  }
  await beforeRetry();
  try {
    return await step();
  } catch (again) {
    if (!isSlow(again)) throw again;
    throw new Error(`${SLOW} - retried once, it was still slow`, { cause: again });
  }
}
