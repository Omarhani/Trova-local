import * as v8 from 'node:v8';

/** Node keeps its HTTP reader (WebAssembly) at its first, quick compile - no recompiling in the background */
export const EXIT_SAFE_FLAG = '--no-wasm-dynamic-tiering';

/**
 * Test 8094 runs 614-616: a TS process ended with "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)". Node 24 on
 * Windows: after a few calls with Node's fetch (the sign-in and clean-up blocks, the phone's WebdriverIO) its HTTP
 * reader is recompiled in the background, and a process that exits while that runs crashes (3 calls then exit: 3 of 3
 * crashed; with this guard 0 of 5). Set in every process of the run (the config is read by each), before any call.
 */
export function guardExit(setFlags: (flag: string) => void = v8.setFlagsFromString): void {
  setFlags(EXIT_SAFE_FLAG);
}
