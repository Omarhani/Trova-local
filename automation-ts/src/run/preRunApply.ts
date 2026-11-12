import { emit } from '../report/liveEvents';
import { runSignInBook } from '../signin/runSignInBook';
import { preRunCheck, PreRunResult } from './preRunCheck';
import { preRunDeps } from './preRunProbes';
import { runStops, Stops } from './runStops';
import { SuitePlan } from './suitePlan';

/** where the pre-run result goes - the run's files and screen, fakes in the unit tests */
export interface PreRunSinks {
  save: (stops: Stops) => void;
  refuse: (login: string, why: string) => void;
  note: (text: string) => void;
  say: (line: string) => void;
}

/** the result reaches the run: stops for the blocks, ended sign-ins refused for the run, each problem told once */
export function applyPreRun(r: PreRunResult, ms: number, sinks: PreRunSinks): void {
  sinks.save(r.stops);
  for (const { login, why } of r.refused) sinks.refuse(login, why);
  const told = [r.stops.app, r.stops.phone, ...r.refused.map((x) => x.why), ...r.warnings].filter((t): t is string => !!t);
  for (const t of told) sinks.note(`Before the run: ${t}`);
  sinks.say(`Checked before the run in ${(ms / 1000).toFixed(1)} s: ${told.length ? `${told.length} to know` : 'everything ready'}`);
}

/** Round 2: the run's ONE pre-run check (10 s at most), told on the run screen and kept for every block */
export async function checkBeforeRun(plan: SuitePlan): Promise<void> {
  const started = Date.now();
  const r = await preRunCheck(preRunDeps(plan));
  applyPreRun(r, Date.now() - started, {
    save: (s) => runStops.save(s),
    refuse: (login, why) => runSignInBook.refuse(login, why),
    note: (text) => emit('note', { text }),
    say: (line) => console.log(line),
  });
}
