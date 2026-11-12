import type { KeptPhone } from './keptPhone';
import type { SuitePlan } from '../run/suitePlan';

/** what the early opening stands on - the real phone in phoneWarmUpDeps, fakes in the unit tests */
export interface WarmDeps {
  /** what holds the phone now (another test session, a lock file); null = free */
  held: () => Promise<string | null>;
  freePort: () => Promise<number>;
  open: (filmPort: number, keepAppData: boolean) => Promise<{ sessionId: string; capabilities: unknown }>;
  save: (kept: Pick<KeptPhone, 'sessionId' | 'filmPort' | 'capabilities' | 'fresh'>) => void;
  /** the "being opened" mark the blocks wait for */
  pending: (on: boolean) => void;
  say: (line: string) => void;
}

/**
 * Round 2 speed (suite setting openPhoneEarly, on by default): the phone is opened early only when an earlier block runs first (a phone block first opens it itself,
 * with no extra reset), with the first phone block's own choice of keeping the app's data.
 */
export function warmUpPlan(plan: SuitePlan): { keepAppData: boolean } | undefined {
  if (/^\s*(off|no|false|0)\s*$/i.test(plan.params.openPhoneEarly ?? '')) return undefined; // the suite setting turns it off
  const first = plan.blocks.findIndex((b) => b.groups.some((g) => /^mob/i.test(g)));
  if (first <= 0) return undefined;
  return { keepAppData: plan.blocks[first].params.keepAppData === 'true' };
}

/**
 * The run's phone session opened while the earlier blocks run (hybrid 64 run 655 spent ~8 s on it after the web
 * sign-in) and kept for the first phone block, which joins it with the app just started (fresh - no second reset). Never takes a
 * phone something else holds; never fails the run - a session that does not open leaves the block to open its own.
 */
export async function warmPhone(d: WarmDeps, keepAppData: boolean): Promise<void> {
  d.pending(true); // at once, before any wait: a block that starts now waits instead of opening a second session
  try {
    if (await d.held().catch(() => 'unknown')) return;
    const filmPort = await d.freePort();
    const started = Date.now();
    const s = await d.open(filmPort, keepAppData);
    d.save({ sessionId: s.sessionId, filmPort, capabilities: s.capabilities as Record<string, unknown>, fresh: true });
    d.say(`Opened the phone for this run while the earlier blocks ran (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch {
    // the first phone block opens its own session and says why if it cannot
  } finally {
    d.pending(false);
  }
}
