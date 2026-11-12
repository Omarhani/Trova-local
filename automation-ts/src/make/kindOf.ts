import { DraftKind } from './draft';
import { MadeAction, MadeRun } from './madeRun';

/** where the case's own steps run: the browser, the phone, or only the app's API */
export type Channel = 'web' | 'phone' | 'api';

function stepActions(run: MadeRun): MadeAction[] {
  return run.steps.flatMap((s) => s.actions);
}

export function channelOf(run: MadeRun): Channel {
  const acts = stepActions(run);
  if (acts.some((a) => a.on === 'phone')) return 'phone';
  if (acts.some((a) => a.on === 'web')) return 'web';
  return 'api';
}

/**
 * The kind of test a run makes: api (every step a call), phone (steps on the phone), hybrid (web steps with the sign-in,
 * set-up or clean-up by API), web (full screen mode: sign-in and clean-up on the screens only).
 */
export function kindOf(run: MadeRun): DraftKind {
  const channel = channelOf(run);
  if (channel !== 'web') return channel;
  const byApi = [...run.setup, ...run.cleanup].some((a) => a.on === 'api');
  return run.mode === 'hybrid' || byApi ? 'hybrid' : 'web';
}
