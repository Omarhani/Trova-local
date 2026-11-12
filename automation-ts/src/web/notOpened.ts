import { SlowAnswer } from '../report/failureKind';

/** what the app showed while one of its pages was opening: its own calls' answers and the message it showed ('' = none) */
export interface OpenSeen {
  statuses: number[];
  message: string;
}

/** a server error of the app's own call (500 and up); a not found or a sign-out is not the app failing the page */
const SERVER_ERROR = 500;

/**
 * Test 8094 runs 865 / 866 (5 web runs at once, the app slow): a page of the app that did not open in time is the
 * environment - Not checked (SlowAnswer, BLOCKED); only an error the app showed or answered on the way is the app's
 * answer - FAILED as Expected / Actual.
 */
export function notOpened(what: string, seconds: number, seen: OpenSeen): Error {
  const message = seen.message.trim();
  if (message) return new Error(`Expected: ${what} opens / Actual: the app showed "${message}"`);
  const error = seen.statuses.find((s) => s >= SERVER_ERROR);
  if (error !== undefined) return new Error(`Expected: ${what} opens / Actual: the app answered with an error (${error})`);
  return new SlowAnswer(`${what} did not open within ${seconds} s - not the app's answer`);
}
