/** the run's started browser as its stop needs it (a ChildProcess) */
export interface Started {
  exitCode: number | null;
  kill(): boolean;
  once(event: 'exit', listener: () => void): unknown;
}

export interface StopSteps {
  removeProfile: () => void;
  release: () => void;
  /** how long the browser may take to stop */
  waitMs: number;
}

/**
 * The run's browser stopped before the run ends (Test 8094 runs 614/615: a fixed 0.5 s was not always enough once the
 * browser kept its downloads; the run ended while the browser was still stopping, Node crashed on exit and the kept
 * folder stayed marked busy). Waits for the browser's own exit (at most waitMs), then its profile goes; the kept folder
 * is always given back. Never throws.
 */
export async function stopBrowser(browser: Started, steps: StopSteps): Promise<void> {
  try {
    if (browser.exitCode === null) {
      const exited = new Promise<void>((done) => browser.once('exit', () => done()));
      browser.kill();
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([exited, new Promise<void>((done) => { timer = setTimeout(done, steps.waitMs); })]);
      clearTimeout(timer);
    }
    try {
      steps.removeProfile();
    } catch {
      // a file still held: the system's temp folder keeps it, the run goes on
    }
  } finally {
    steps.release();
  }
}
