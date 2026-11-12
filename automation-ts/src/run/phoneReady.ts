/**
 * Round 2: is the run's phone ready - read from adb's and Appium's own answers (plain rules; preRunProbes asks them).
 */

/** null when the phone is there and ready ("device" in adb devices); else why not. udid "" = any ready phone */
export function phoneStateIn(adbDevices: string, udid: string): string | null {
  const rows = adbDevices.split(/\r?\n/).slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2);
  if (!udid) return rows.some((r) => r[1] === 'device') ? null : 'No phone is connected to this computer - connect it by cable with USB debugging on';
  const state = rows.find((r) => r[0] === udid)?.[1];
  if (state === 'device') return null;
  if (state === 'unauthorized') return `The phone ${udid} asks to allow USB debugging - unlock it and allow this computer`;
  return `The phone ${udid} is not connected to this computer (or not ready) - connect it by cable with USB debugging on`;
}

/** the lock screen shows (Android's window list) */
export function lockedIn(dumpsysWindow: string): boolean {
  return /mDreamingLockscreen=true|mShowingLockscreen=true|isKeyguardShowing=true|mKeyguardShowing=true/.test(dumpsysWindow);
}

type Sessions = { value?: Array<{ id?: string; capabilities?: Record<string, unknown> }> };

/** another test session drives this phone now (Appium's session list); the run's own kept session does not count */
export function otherSessionOn(sessions: Sessions, udid: string, ownSessionId: string | undefined): boolean {
  return (sessions.value ?? []).some((s) => {
    if (s.id && s.id === ownSessionId) return false;
    const on = String(s.capabilities?.udid ?? s.capabilities?.['appium:udid'] ?? s.capabilities?.deviceUDID ?? '');
    return !udid || !on || on === udid;
  });
}

/** a lock file the tester named in the settings: its text says who holds the phone; null = free (none, or this run's owner) */
export function lockFileSays(text: string | undefined, owner: string): string | null {
  if (text === undefined) return null;
  const who = text.trim().split(/\r?\n/)[0] || 'someone';
  return owner.trim() && who === owner.trim() ? null : `The phone is held by ${who} (its lock file is there)`;
}

/**
 * Round 2 (tester, suggestion 1): before a phone case, a phone held by something else is waited for - at most limitMs
 * (2 min) - then the case is blocked with what held it. null = free.
 */
export async function waitPhoneFree(held: () => Promise<string | null>, limitMs = 120_000, everyMs = 3_000): Promise<string | null> {
  const until = Date.now() + limitMs;
  for (;;) {
    const why = await held();
    if (!why) return null;
    if (Date.now() + everyMs > until) {
      return `The phone is used by something else (${why}) - waited ${Math.round(limitMs / 60_000) || 1} min, the case could not run`;
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

const LOOK_EVERY_MS = 150;

/** review G14: a condition wait - looks again until the lock screen is gone (true), or ms passed (false) */
export async function lockGoneWithin(locked: () => Promise<boolean>, ms: number, every = LOOK_EVERY_MS): Promise<boolean> {
  for (const until = Date.now() + ms; ; await new Promise((r) => setTimeout(r, every))) {
    if (!(await locked())) return true;
    if (Date.now() >= until) return false;
  }
}
