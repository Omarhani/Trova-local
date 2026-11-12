import * as fs from 'node:fs';
import * as path from 'node:path';

/** the run's one phone session, kept between its phone blocks (each block runs in its own process) */
export interface KeptPhone {
  runId: string;
  sessionId: string;
  /** the computer's port the phone streams its screen to (the session's film) */
  filmPort: number;
  capabilities: Record<string, unknown>;
  /** Round 2: opened early by the run, the app just started as a new session starts it - the first block needs no reset */
  fresh?: boolean;
}

/** the run of this process ("local" outside Trova) */
export function runIdNow(env: NodeJS.ProcessEnv = process.env): string {
  return env.TROVA_RUN_ID?.trim() || 'local';
}

/** where a run's kept phone session is written: one small file per run in the project's target folder */
export class KeptPhoneFile {
  constructor(private readonly dir: string) {}

  file(runId: string): string {
    return path.join(this.dir, `phone-session-${runId.replace(/[^\w-]/g, '_')}.json`);
  }

  save(kept: KeptPhone): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file(kept.runId), JSON.stringify(kept));
  }

  /** the run's kept session; undefined when none (or the file is unreadable) */
  load(runId: string): KeptPhone | undefined {
    try {
      const k = JSON.parse(fs.readFileSync(this.file(runId), 'utf8')) as KeptPhone;
      return k.runId === runId && k.sessionId ? k : undefined;
    } catch {
      return undefined;
    }
  }

  forget(runId: string): void {
    fs.rmSync(this.file(runId), { force: true });
    this.markPending(runId, false);
  }

  /** Round 2: the run's session is being opened early (phoneWarmUp) - its blocks wait for it */
  markPending(runId: string, on: boolean): void {
    const mark = `${this.file(runId)}.pending`;
    if (!on) return fs.rmSync(mark, { force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(mark, '');
  }

  /** the run's kept session once no early opening is under way (waitMs at most for a mark left behind) */
  async loadWhenReady(runId: string, waitMs = 90_000, everyMs = 200): Promise<KeptPhone | undefined> {
    const until = Date.now() + waitMs;
    while (fs.existsSync(`${this.file(runId)}.pending`) && Date.now() < until) await new Promise((r) => setTimeout(r, everyMs));
    return this.load(runId);
  }
}

export const keptPhoneFile = new KeptPhoneFile(path.resolve(__dirname, '..', '..', 'target'));
