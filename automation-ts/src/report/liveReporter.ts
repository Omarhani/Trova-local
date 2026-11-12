import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { retryBook } from '../run/retryBook';
import { CaseTries, TryDecisions } from './caseTries';
import { sayFailureFacts } from './failureFacts';
import { liveLine, testType } from './liveEvents';
import { trapBlock } from './trapBlock';

/** what the reporter is given: where a second try's decision goes, where its lines go (tests give fakes) */
export interface LiveReporterOptions {
  decisions?: TryDecisions;
  print?: (line: string) => void;
}

/**
 * Playwright reporter that speaks Trova's live feed: "run" when the suite starts, "test" / "end" per test with its
 * <test> block (the Playwright project) - the same events the Java runs print. The tests' own lines (steps, checks,
 * console) pass through as they are. Round 2: one row per case - a set-up problem's second try is told on the same
 * row (CaseTries), a wrong result is FAILED at once and never tried again; BLOCKED says why the case could not run.
 */
export default class LiveReporter implements Reporter {
  private n = 0;
  private readonly tries: CaseTries;
  private readonly print: (line: string) => void;

  constructor(options: LiveReporterOptions = {}) {
    this.tries = new CaseTries(options.decisions ?? retryBook);
    this.print = options.print ?? ((line) => process.stdout.write(`${line}\n`));
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.emit('run', { suite: process.env.TROVA_SUITE_NAME ?? 'TS suite', env: process.env.TROVA_ENV ?? '',
                       browser: process.env.TROVA_BROWSER ?? '', tests: suite.allTests().length, workers: config.workers });
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    if (!this.tries.begins(test.id, result.retry)) return;
    const block = test.parent.project()?.name ?? '';
    const meta = test.parent.project()?.metadata as { groups?: string[]; params?: Record<string, string> } | undefined;
    const trap = trapBlock(meta?.params) ? { trap: true } : {}; // run 881: a trap is never looked at, helped or treated
    this.emit('test', { n: ++this.n, name: test.title, block, type: testType(meta?.groups ?? []), ...trap });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const skip = test.annotations.find((a) => a.type === 'skip')?.description
      ?? result.annotations.find((a) => a.type === 'skip')?.description;
    const out = this.tries.ends(test.id, {
      status: result.status, errors: result.errors.map((e) => e.message ?? e.value ?? ''), skipReason: skip,
      annotations: [...test.annotations, ...result.annotations], retry: result.retry, retries: test.retries,
    });
    if (!out.end && !out.note) return; // the kept first try: its second process only stepped aside
    sayFailureFacts(test.title, result, this.print); // Test 8094 run 585: into the run's console
    if (out.note) this.emit('note', { text: out.note });
    if (out.end) this.emit('end', { status: out.end.status, msg: out.end.msg, ms: result.duration, retry: result.retry });
  }

  onStdOut(chunk: string | Buffer): void {
    process.stdout.write(chunk);
  }

  onStdErr(chunk: string | Buffer): void {
    process.stderr.write(chunk);
  }

  printsToStdio(): boolean {
    return true;
  }

  private emit(type: string, fields: Record<string, unknown>): void {
    this.print(liveLine({ t: type, ...fields }));
  }
}
