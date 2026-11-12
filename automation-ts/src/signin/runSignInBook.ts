import * as fs from 'node:fs';
import * as path from 'node:path';
import { SavedSignIn } from './savedSignIn';

type Entry = { saved?: SavedSignIn; refused?: string };

/** the run's sign-in folder: <automation-ts>/target/run-sign-ins-<run> (git-ignored), 'local' outside a Trova run */
export function runSignInDir(env: NodeJS.ProcessEnv = process.env): string {
  const run = (env.TROVA_RUN_ID?.trim() || 'local').replace(/[^\w-]/g, '_');
  return path.resolve(__dirname, '..', '..', 'target', `run-sign-ins-${run}`);
}

/**
 * The run's ONE sign-in per login name, saved for every later case (the blocks run in worker processes one after
 * another, so it is a file per login), and a refusal that skips the login's later cases. Lives only in the run's own
 * target folder, written owner-only, deleted at the run's start and end; its values are never printed.
 */
export class RunSignInBook {
  constructor(private readonly dir: () => string = runSignInDir) {}

  saved(login: string): SavedSignIn | undefined {
    return this.read(login).saved;
  }

  save(login: string, saved: SavedSignIn): void {
    this.write(login, { saved });
  }

  refused(login: string): string | undefined {
    return this.read(login).refused;
  }

  refuse(login: string, why: string): void {
    this.write(login, { ...this.read(login), refused: why });
  }

  forget(): void {
    fs.rmSync(this.dir(), { recursive: true, force: true, maxRetries: 3 });
  }

  private file(login: string): string {
    const name = login.trim().toLowerCase().replace(/[^a-z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`);
    return path.join(this.dir(), `${name || '_'}.json`);
  }

  private read(login: string): Entry {
    try {
      return JSON.parse(fs.readFileSync(this.file(login), 'utf8')) as Entry;
    } catch {
      return {};
    }
  }

  private write(login: string, entry: Entry): void {
    const file = this.file(login);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.part`, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(`${file}.part`, file);
  }
}

/** the run's one book */
export const runSignInBook = new RunSignInBook();
