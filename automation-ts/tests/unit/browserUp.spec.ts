import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { browserUp } from '../../src/web/browserUp';

/** a browser's DevTools address that answers only after readyMs */
async function devTools(readyMs: number): Promise<{ at: string; open: () => number; close: () => Promise<void> }> {
  const started = Date.now();
  const server = http.createServer((_req, res) => {
    if (Date.now() - started < readyMs) { res.statusCode = 503; res.end(); return; }
    res.end('{"Browser":"Chrome"}');
  });
  let open = 0;
  server.on('connection', (s) => { open++; s.on('close', () => open--); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { at: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, open: () => open,
    close: () => new Promise((r) => server.close(() => r())) };
}

test('waits until the browser answers, and leaves no connection open to it (Test 8094 runs 614/615: Node crashed on exit)', async () => {
  const d = await devTools(300);
  await browserUp(d.at, 5000);
  await new Promise((r) => setTimeout(r, 100));
  expect(d.open()).toBe(0);
  await d.close();
});

test('a browser that never answers: plain words after the wait', async () => {
  await expect(browserUp('http://127.0.0.1:9', 500)).rejects.toThrow('The run\'s browser did not start within 0.5 s');
});

test('the run is ending: no more looks', async () => {
  const start = Date.now();
  await expect(browserUp('http://127.0.0.1:9', 5000, () => Date.now() - start > 200)).rejects.toThrow();
  expect(Date.now() - start).toBeLessThan(2000);
});
