import { ConsoleMessage, Page, Request } from '@playwright/test';
import { emit } from '../report/liveEvents';
import { CallFacts, callEvent, openEvent, wantedCall } from '../report/networkEvents';
import { pageMessageOf } from './pageMessages';
import { signOutSigns } from './signin/signOutSigns';

const watched = new WeakSet<Page>();
const LEVEL: Record<string, string> = { error: 'error', warning: 'warning', info: 'info' };

/** a console line as the Java helpers send it: level error / warning / info / log, the text on one line, at most 1000 */
function consoleLine(level: string, text: string): void {
  if (pageMessageOf(text) !== undefined) return; // a message the page showed - told by pageMessages, not a console line
  const line = text.replace(/[\r\n]+/g, ' ');
  emit('console', { level, text: line.length <= 1000 ? line : `${line.slice(0, 1000)}...` });
}

/** what the browser saw of one call; its bodies only for JSON or text answers (utils.NetworkRecorder.readBodies) */
async function factsOf(request: Request, sent: number, error = ''): Promise<CallFacts> {
  const response = error ? null : await request.response().catch(() => null);
  const mime = response?.headers()['content-type'] ?? '';
  const isPage = request.resourceType() === 'document';
  const text = response && !isPage && (mime.includes('json') || mime.startsWith('text/')) ? await response.text().catch(() => undefined) : undefined;
  const timing = request.timing();
  const ms = timing.responseEnd > 0 ? timing.responseEnd : Date.now() - sent;
  return { method: request.method(), url: request.url(), sent, status: response?.status() ?? 0, ms,
    request: isPage ? undefined : request.postData() ?? undefined, response: text, error };
}

/**
 * The run screen's Network and Problems for a web page, as the Java helpers feed them (utils.NetworkRecorder, LiveFeed):
 * each of the page's own calls and page loads ("call" / "open", addresses and bodies masked, never a cookie or an auth
 * header), every console line with its level and the page's own errors ("console"). Watches a page once. An answer
 * that says the sign-in ran out is noted for the step guard (Java NetworkRecorder -> SignOutSigns).
 */
export function watchNetwork(page: Page): void {
  if (watched.has(page)) return;
  watched.add(page);
  const sentAt = new WeakMap<Request, number>();
  page.on('request', (r) => { if (wantedCall(r.resourceType(), r.url(), r.method())) sentAt.set(r, Date.now()); });
  const done = (r: Request, error = ''): void => {
    const sent = sentAt.get(r);
    if (sent === undefined) return;
    sentAt.delete(r);
    void factsOf(r, sent, error).then((c) => (signOutSigns.note(c.status, c.response), c)).then((c) => emit(r.resourceType() === 'document' ? 'open' : 'call', r.resourceType() === 'document' ? openEvent(c) : callEvent(c)), () => undefined);
  };
  page.on('requestfinished', (r) => done(r));
  page.on('requestfailed', (r) => done(r, r.failure()?.errorText ?? 'no answer'));
  page.on('console', (m: ConsoleMessage) => consoleLine(LEVEL[m.type()] ?? 'log', m.text()));
  page.on('pageerror', (e) => consoleLine('error', e.message));
}
