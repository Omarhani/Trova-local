import * as path from 'node:path';
import { emit } from '../../report/liveEvents';
import { causeWords, firstLine, HelpAnswer, readAnswer } from './helpAnswer';
import { StuckAt } from './stuckAt';

type Emit = (type: string, fields: Record<string, unknown>) => void;

/** one number per ask in this process, web and phone together: each answer file is its own */
let asked = 0;

/**
 * The ask itself, the same for a web and a phone step (Omar 2026-10-25 / 2026-11-11): the live line {"t":"ai-help", ...}
 * reaches Trova's runner, whose AI works on the test's own browser or phone; its answer comes back as
 * <live folder>/ai-help-<n>.json. Only in a Trova run (its live folder).
 */
export class RunnerHelp {
  constructor(private readonly liveDir: string | undefined = process.env.TROVA_LIVE_DIR?.trim() || undefined,
              private readonly waitMs = 150_000,
              private readonly pollMs = 500,
              private readonly say: Emit = emit) {}

  /** this run can ask (a Trova run with its live folder) */
  on(): boolean {
    return !!this.liveDir;
  }

  /** asks with these fields (the stuck step, its test and what the runner's AI needs) and waits; null = no AI help here */
  async ask(where: StuckAt, failed: Error, fields: Record<string, unknown>): Promise<HelpAnswer | null> {
    if (!this.liveDir) return null;
    const n = ++asked;
    const file = path.join(this.liveDir, `ai-help-${n}.json`);
    this.say('ai-help', { n, step: where.step, test: where.test, problem: firstLine(failed), ...fields });
    for (const until = Date.now() + this.waitMs; Date.now() < until; await pause(this.pollMs)) {
      const a = readAnswer(file);
      if (!a) continue;
      if (a.helped) this.said(a, where.step);
      return a;
    }
    return { helped: false, did: '', why: 'AI help did not answer within 2 minutes' };
  }

  /** the run's step list says what the AI did and why it was stuck */
  private said(a: HelpAnswer, step: string): void {
    const why = a.cause ? ` · cause: ${causeWords(a.cause)}${a.proof ? ` - ${a.proof}` : ''}` : '';
    this.say('step', { a: 'AI help', e: `AI helped: ${a.did || 'got past the stuck step'}${why}`, l: '', c: step });
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
