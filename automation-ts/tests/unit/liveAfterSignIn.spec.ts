import { ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { freePort } from '../../src/core/freePort';
import { browserUp } from '../../src/web/browserUp';
import { chromeArgs, chromePath } from '../../src/web/chromePath';
import { sharedTab } from '../../src/web/sharedBrowser';
import { putState } from '../../src/web/signin/browserPut';

/**
 * Test 8094 run 619: the live Browser picture stayed empty while a case put its sign-in in. The live screen watches the
 * run's one browser as the runner does (its first page, a socket of its own, a screencast): pictures keep coming after a
 * sign-in is put in, also for the next block that joins the same browser.
 */
const ORIGIN = 'http://app.test';
const STATE = { localStorage: { token: 'kept-value' }, sessionStorage: {}, cookies: {} };

let chrome: ChildProcess;
let at: string;
let profile: string;

test.beforeAll(async () => {
  const exe = chromePath('Chrome', process.platform, process.env, (f) => fs.existsSync(f));
  test.skip(!exe, 'no Chrome on this computer');
  const port = await freePort();
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trova-live-test-'));
  chrome = spawn(exe!, chromeArgs(port, profile, { width: 1920, height: 1080 }), { stdio: 'ignore', windowsHide: true });
  at = `http://127.0.0.1:${port}`;
  await browserUp(at, 30_000);
});

test.afterAll(async () => {
  chrome?.kill();
  await new Promise((r) => setTimeout(r, 500));
  if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
});

/** the runner's live screen: the first page's socket and a 720p screencast; counts the pictures it gets */
async function liveScreen(): Promise<{ frames: () => number; close: () => void }> {
  const list = await (await fetch(`${at}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[];
  const ws = new WebSocket(list.find((t) => t.type === 'page')!.webSocketDebuggerUrl);
  let frames = 0;
  let id = 1;
  const send = (method: string, params: object) => ws.send(JSON.stringify({ id: id++, method, params }));
  ws.onmessage = (m) => {
    const d = JSON.parse(String(m.data));
    if (d.method !== 'Page.screencastFrame') return;
    frames++;
    send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
  };
  await new Promise((r) => { ws.onopen = r; });
  send('Page.enable', {});
  send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  return { frames: () => frames, close: () => ws.close() };
}

/** one block: joins the run's browser, puts the sign-in in, opens the app; the pictures the live screen got meanwhile */
async function block(live: { frames: () => number }, text: string): Promise<number> {
  const browser = await chromium.connectOverCDP(at);
  const page = await sharedTab(browser);
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html', body: `<h1>${text}</h1><script>let n = 0; setInterval(() => document.querySelector('h1').textContent = '${text} ' + n++, 100)</script>` }));
  const before = live.frames();
  await putState(page, STATE, ORIGIN);
  await page.goto(`${ORIGIN}/`);
  await page.waitForTimeout(1500);
  await browser.close();
  return live.frames() - before;
}

test('the live picture keeps coming after a sign-in is put in, block after block', async () => {
  const live = await liveScreen();
  try {
    expect(await block(live, 'first block')).toBeGreaterThan(3);
    expect(await block(live, 'second block')).toBeGreaterThan(3);
  } finally {
    live.close();
  }
});
