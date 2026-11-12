import * as fs from 'node:fs';
import { lockFileSays, otherSessionOn } from '../run/phoneReady';
import { appiumAddress } from './phoneSession';

/** the lock file the tester named (setting TROVA_PHONE_LOCK_FILE; none by default) - its text, undefined = no file */
function lockText(env: NodeJS.ProcessEnv): string | undefined {
  const file = env.TROVA_PHONE_LOCK_FILE?.trim();
  if (!file) return undefined;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** Appium's own list of open test sessions; none when it cannot say */
async function sessions(): Promise<{ value?: Array<{ id?: string; capabilities?: Record<string, unknown> }> }> {
  const a = appiumAddress();
  try {
    const r = await fetch(`http://${a.hostname}:${a.port}${a.path.replace(/\/$/, '')}/appium/sessions`, { signal: AbortSignal.timeout(3_000) });
    return r.ok ? (await r.json()) as { value?: [] } : {};
  } catch {
    return {};
  }
}

/**
 * Round 2 (tester, suggestion 1): what holds the run's phone now - a lock file the tester named, or another test
 * session on it (the run's own kept session does not count); null = free.
 */
export async function phoneHeldBy(ownSessionId: string | undefined, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const lock = lockFileSays(lockText(env), env.TROVA_PHONE_LOCK_OWNER ?? '');
  if (lock) return lock;
  return otherSessionOn(await sessions(), env.TROVA_UDID?.trim() ?? '', ownSessionId) ? 'another test session drives it' : null;
}
