import * as fs from 'node:fs';
import * as path from 'node:path';
import { SignInResult } from '../trova/recipeSignIn';
import { endOfToken } from '../web/signin/signInClock';

type Kept = Record<string, SignInResult>;

/** the run's sign-ins file (the blocks run in worker processes one after another); '' outside a Trova run: nothing kept */
export function runSignInsFile(): string {
  const run = process.env.TROVA_RUN_ID?.trim();
  return run ? path.resolve(__dirname, '..', '..', 'target', `sign-ins-${run.replace(/[^\w-]/g, '_')}.json`) : '';
}

/**
 * The sign-ins this run made with the app's own sign-in calls, for every later block of the same run - Java signs in
 * once per run ("every test of this run uses this sign-in"); Test 8094 run 612 signed in 3 times, once per block's
 * worker. One that runs out soon is not given again. Kept in the run's target folder only while the run goes on
 * (forgotten at its start and end, like Trova's own run file); never printed.
 */
export class RunSignIns {
  constructor(private readonly file: () => string = runSignInsFile, private readonly now: () => number = () => Date.now()) {}

  /** the run's sign-in for this side and login, or undefined (none, or it runs out soon) */
  get(key: string): SignInResult | undefined {
    if (!this.file()) return undefined;
    const one = this.read()[key];
    if (!one || typeof one.token !== 'string' || !one.browser) return undefined;
    return endOfToken(one.token, this.now()).soon(this.now()) ? undefined : one;
  }

  keep(key: string, result: SignInResult): void {
    const file = this.file();
    if (!file) return;
    const all = { ...this.read(), [key]: result };
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.part`, JSON.stringify(all), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(`${file}.part`, file);
    } catch {
      // not kept: the next block signs in by itself, as before
    }
  }

  forget(): void {
    if (this.file()) fs.rmSync(this.file(), { force: true });
  }

  private read(): Kept {
    try {
      const all = JSON.parse(fs.readFileSync(this.file(), 'utf8')) as unknown;
      return all && typeof all === 'object' && !Array.isArray(all) ? all as Kept : {};
    } catch {
      return {};
    }
  }
}

/** the run's one store */
export const runSignIns = new RunSignIns();
