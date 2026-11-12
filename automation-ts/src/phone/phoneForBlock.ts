import { KeptPhone } from './keptPhone';
import { Phone } from './phoneSession';

/** what a phone block needs to get its session - given by blockPhoneDeps, faked in the unit tests */
export interface BlockPhoneDeps {
  /** the run's kept session, if any */
  kept(): KeptPhone | undefined;
  attach(kept: KeptPhone): Promise<Phone>;
  open(filmPort: number, keepAppData: boolean): Promise<Phone>;
  freePort(): Promise<number>;
  save(phone: Phone, filmPort: number): void;
  forget(): void;
  /** the app as a new session would start it: data cleared, or (keepAppData) only closed and opened again */
  reset(phone: Phone, keepAppData: boolean): Promise<void>;
  /**
   * run 718: the app, once it has started, is on its sign-in screen (nothing old can show there, so a block that keeps
   * the app's data need not start it again - ~20 s on the realme 7); absent = always started again
   */
  onSignIn?(phone: Phone): Promise<boolean>;
  /** the session ended; never fails */
  end(phone: Phone): Promise<void>;
}

export interface BlockPhone {
  phone: Phone;
  filmPort: number;
}

/**
 * The phone session of a block: the run's kept one with the app reset as a new session starts it (a new session took
 * 9-20 s on the realme 7, the reset 1-4 s); none kept, or the kept one gone = a new session, kept for the next blocks.
 */
export async function phoneForBlock(keepAppData: boolean, deps: BlockPhoneDeps): Promise<BlockPhone> {
  const kept = deps.kept();
  if (kept) {
    const phone = await deps.attach(kept);
    try {
      // Round 2: opened early with its data cleared, the app shows only its first screen - nothing old to see; a block that
      // keeps the app's data starts it again, so it reads what the earlier blocks made (review fix 6)
      if (!kept.fresh || (keepAppData && !(await deps.onSignIn?.(phone).catch(() => false)))) await deps.reset(phone, keepAppData);
      if (kept.fresh) deps.save(phone, kept.filmPort); // the fresh mark goes: the next block resets as always
      return { phone, filmPort: kept.filmPort };
    } catch {
      await deps.end(phone);
      deps.forget();
    }
  }
  const filmPort = await deps.freePort();
  const phone = await deps.open(filmPort, keepAppData);
  deps.save(phone, filmPort);
  return { phone, filmPort };
}

/** after a block: a passed one leaves the session to the next block; a failed one ends it so the next starts clean */
export async function afterBlock(phone: Phone, passed: boolean, deps: Pick<BlockPhoneDeps, 'end' | 'forget'>): Promise<void> {
  if (passed) return;
  await deps.end(phone);
  deps.forget();
}

export interface RunEndDeps {
  kept(): KeptPhone | undefined;
  endKept(kept: KeptPhone): Promise<void>;
  forget(): void;
}

/** the run's end: its kept session closed (the phone free for the next user) and forgotten */
export async function endKeptPhone(deps: RunEndDeps): Promise<void> {
  const kept = deps.kept();
  if (!kept) return;
  try {
    await deps.endKept(kept);
  } catch {
    // already gone (Appium stopped or the session timed out): nothing left to close
  }
  deps.forget();
}
