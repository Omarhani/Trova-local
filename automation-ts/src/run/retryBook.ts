import * as fs from 'node:fs';
import * as path from 'node:path';

/** <automation-ts>/target/run-tries-<run>.json (git-ignored), 'local' outside a Trova run */
export function retryBookFile(env: NodeJS.ProcessEnv = process.env): string {
  const run = (env.TROVA_RUN_ID?.trim() || 'local').replace(/[^\w-]/g, '_');
  return path.resolve(__dirname, '..', '..', 'target', `run-tries-${run}.json`);
}

/**
 * Round 2: the live reporter decides whether a case's second try may run (only after a set-up problem); the second
 * try runs in a new process, so the decision goes through the run's own small file. No value of the app is in it.
 */
export class RetryBook {
  constructor(private readonly file: () => string = () => retryBookFile()) {}

  allow(testId: string): void {
    this.write(testId, true);
  }

  keep(testId: string): void {
    this.write(testId, false);
  }

  allowed(testId: string): boolean {
    return this.read()[testId] === true;
  }

  forget(): void {
    fs.rmSync(this.file(), { force: true });
  }

  private read(): Record<string, boolean> {
    try {
      return JSON.parse(fs.readFileSync(this.file(), 'utf8')) as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  private write(testId: string, allowed: boolean): void {
    const file = this.file();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.part`, JSON.stringify({ ...this.read(), [testId]: allowed }));
    fs.renameSync(`${file}.part`, file);
  }
}

const ON = /^\s*(once|on|yes|1|true)\s*$/i;

/**
 * How many more tries a case gets: TROVA_RETRIES when the run gives it, else none - the house rule (Lead 2026-11-11):
 * no whole-case retry; <parameter name="setUpRetry" value="once"/> gives one, used only by a set-up problem.
 */
export function retriesFor(env: NodeJS.ProcessEnv, suiteParams: Record<string, string>): number {
  const given = env.TROVA_RETRIES?.trim();
  if (given && /^\d+$/.test(given)) return Number(given);
  return ON.test(suiteParams.setUpRetry ?? '') ? 1 : 0;
}

export const retryBook = new RetryBook();
