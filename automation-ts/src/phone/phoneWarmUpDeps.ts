import { freePort } from '../core/freePort';
import type { SuitePlan } from '../run/suitePlan';
import { keptPhoneFile, runIdNow } from './keptPhone';
import { phoneHeldBy } from './phoneHeld';
import { openPhone } from './phoneSession';
import { warmPhone, warmUpPlan } from './phoneWarmUp';

/** Round 2 speed: the run's phone opened in the background while the earlier blocks run; resolves when it is done */
export function startPhoneWarmUp(plan: SuitePlan): Promise<void> {
  const p = warmUpPlan(plan);
  if (!p) return Promise.resolve();
  const runId = runIdNow();
  return warmPhone({
    held: () => phoneHeldBy(undefined),
    freePort,
    open: async (port, keep) => {
      const phone = await openPhone(port, keep);
      return { sessionId: phone.sessionId, capabilities: phone.capabilities };
    },
    save: (k) => keptPhoneFile.save({ runId, ...k }),
    pending: (on) => keptPhoneFile.markPending(runId, on),
    say: (line) => console.log(line),
  }, p.keepAppData);
}

/** a phone block first lets an early opening finish, then joins the run's session */
export async function waitForEarlyPhone(): Promise<void> {
  await keptPhoneFile.loadWhenReady(runIdNow());
}
