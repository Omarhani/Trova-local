/** a tap and what it should open */
export interface TapAndLook {
  tap(): Promise<void>;
  /** true once what the tap opens shows (looked for at most seconds) */
  opened(seconds: number): Promise<boolean>;
}

/**
 * Taps and, when nothing opened within seconds, taps again (tries in all) - the Java tapAgainIfNothingChanged, in place of
 * a fixed wait for a screen that loads in steps (a tap during its placeholders opens nothing). True once it opened.
 */
export async function tapUntilOpened(io: TapAndLook, tries = 3, seconds = 3): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await io.tap();
    if (await io.opened(seconds)) return true;
  }
  return false;
}
