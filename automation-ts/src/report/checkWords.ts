/**
 * A check line in plain words (Omar, run 633: "Home greeting: ok" said nothing): what was checked, the expected value,
 * what was seen, then ✓ or ✗ - never a bare "ok". hide = the run's secrets as ***.
 */
export function compared(what: string, ok: boolean, expected: string, seen: string, hide: (t: string) => string): string {
  return hide(`${what} - expected ${expected}, seen ${seen} ${ok ? '✓' : '✗'}`);
}

/** a yes / no check: what happened with ✓, or ✗ with the reason when there is one */
export function happened(what: string, ok: boolean, why: string, hide: (t: string) => string): string {
  return hide(ok ? `${what} ✓` : `${what} ✗${why ? ` - ${why}` : ''}`);
}
