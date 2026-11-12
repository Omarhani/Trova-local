import * as fs from 'node:fs';

/** helped = the AI got past it (did = what it did); else why = the plain reason for the failure, or undefined */
export interface HelpAnswer {
  helped: boolean;
  did: string;
  why?: string;
  /** self-healing (Omar 2026-11-11): why the step was stuck - OUR_CODE, APP, ENVIRONMENT, UNKNOWN - and what showed it */
  cause?: string;
  proof?: string;
}

/** a cause in a tester's words */
export function causeWords(cause: string | undefined): string {
  return cause === 'OUR_CODE' ? 'our test code' : cause === 'APP' ? 'the app'
    : cause === 'ENVIRONMENT' ? 'the network, browser or computer' : 'not clear';
}

/** the runner's answer, read once and removed; undefined while it is not there (or half written) */
export function readAnswer(file: string): HelpAnswer | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    const a = JSON.parse(fs.readFileSync(file, 'utf8')) as { ok?: boolean; did?: string | null; why?: string | null; cause?: string | null; proof?: string | null };
    fs.rmSync(file, { force: true });
    const found: HelpAnswer = { helped: a.ok === true, did: a.did ?? '', why: a.why ?? undefined };
    if (a.cause) Object.assign(found, { cause: a.cause, proof: a.proof ?? '' });
    return found;
  } catch {
    return undefined;
  }
}

/** the error's first line, 300 at most */
export function firstLine(failed: Error | undefined): string {
  const m = failed?.message || 'a wait ran out';
  const one = m.split('\n')[0];
  return one.length > 300 ? one.slice(0, 300) : one;
}
