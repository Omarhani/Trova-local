/** what the case says when the phone connection ends in the middle of it (Test 8094 run 605) */
export const PHONE_CLOSED = 'The phone connection closed during the case - the phone may have been used by another test or person at the same time. Run the case again when the phone is free.';

/** the driver's words for a phone connection that ended: the session is gone, or the phone's test helper stopped */
const GONE = /invalid session id|session is either terminated or not started|instrumentation process is not running|socket hang up/i;

export function isPhoneGone(error: unknown): boolean {
  return error instanceof Error && GONE.test(error.message);
}

/** a phone call: when its connection has ended, it fails in plain words instead of the driver's error */
export async function onPhone<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (isPhoneGone(e)) throw new Error(PHONE_CLOSED);
    throw e;
  }
}
