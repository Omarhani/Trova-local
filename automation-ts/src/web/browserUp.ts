import * as http from 'node:http';

/** one look at the browser's DevTools address on a connection of its own, closed right after (no kept-alive socket) */
function answers(at: string): Promise<boolean> {
  return new Promise((done) => {
    const req = http.get(`${at}/json/version`, { agent: false, timeout: 1000 }, (res) => {
      res.resume();
      res.on('end', () => done(res.statusCode === 200));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => done(false));
  });
}

/**
 * Waits until the run's browser answers on its DevTools address (at most ms). Each look closes its connection: Node's
 * fetch kept one open to the browser, which was still closing when the browser stopped at the run's end and Node
 * crashed on exit (Test 8094 runs 614/615, "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). stopped = the run
 * is ending: no more looks.
 */
export async function browserUp(at: string, ms = 30_000, stopped: () => boolean = () => false): Promise<void> {
  for (const until = Date.now() + ms; Date.now() < until && !stopped();) {
    if (await answers(at)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`The run's browser did not start within ${ms / 1000} s`);
}
