import type { TestInfo } from '@playwright/test';
import { blockedSkip } from '../report/blockedSkip';
import { waitPhoneFree } from '../run/phoneReady';
import { runStops } from '../run/runStops';
import { phoneHeldBy } from './phoneHeld';

/**
 * Round 2 (tester, suggestion 1): a phone case starts only on a free phone - held by something else, it waits at most
 * 2 min, then it is BLOCKED with what held it and the run's later phone cases stop at once (the clean-up still runs).
 */
export async function phoneFreeOrBlocked(testInfo: TestInfo, ownSessionId: string | undefined): Promise<void> {
  const held = await waitPhoneFree(() => phoneHeldBy(ownSessionId));
  if (!held) return;
  runStops.save({ ...runStops.read(), phone: held });
  blockedSkip(testInfo, 'setup', held);
}
