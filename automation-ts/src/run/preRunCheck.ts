import type { BrowserLook } from '../signin/browserSignIn';
import type { Stops } from './runStops';

/** what the pre-run check looks at - the real computer in preRunProbes, fakes in the unit tests */
export interface PreRunDeps {
  /** the logins the suite signs in as on the web side */
  webLogins: string[];
  needsPhone: boolean;
  look: (login: string) => BrowserLook;
  /** the phone connected, unlocked and free: null, else why not */
  phone: () => Promise<string | null>;
  /** the phone server (Appium) answers: null, else why not */
  appium: () => Promise<string | null>;
  /** the app's server answers: null, else why not */
  app: () => Promise<string | null>;
  now: () => number;
}

export interface PreRunResult {
  stops: Stops;
  /** logins whose saved web sign-in has ended: their cases stop at once with this reason */
  refused: Array<{ login: string; why: string }>;
  warnings: string[];
}

const SOON = 30 * 60_000;

/**
 * Round 2 (Omar 2026-11-11): ONE look before the first case, 10 s at most - the saved web sign-in (ended = its cases
 * stop at once; ends within 30 min = a warning with its clock time), the phone connected, unlocked and free, its
 * server, the app's server. A problem stops the cases it touches at once with one reason - no case waits for its own
 * time-out. Every look runs at the same time; one that does not answer within the limit counts as not ready.
 */
export async function preRunCheck(d: PreRunDeps, limitMs = 10_000): Promise<PreRunResult> {
  const [app, phone, appium] = await Promise.all([
    bounded(d.app, limitMs, "the app's server"),
    d.needsPhone ? bounded(d.phone, limitMs, 'the phone') : Promise.resolve(null),
    d.needsPhone ? bounded(d.appium, limitMs, 'the phone server (Appium)') : Promise.resolve(null),
  ]);
  const stops: Stops = {};
  if (app) stops.app = app;
  if (phone ?? appium) stops.phone = (phone ?? appium)!;
  const { refused, warnings } = webSignIns(d);
  return { stops, refused, warnings };
}

function webSignIns(d: PreRunDeps): Pick<PreRunResult, 'refused' | 'warnings'> {
  const refused: PreRunResult['refused'] = [];
  const warnings: string[] = [];
  for (const login of [...new Set(d.webLogins.filter((l) => l.trim()))]) {
    const look = d.look(login);
    if (look.kind === 'ended') refused.push({ login, why: look.why });
    if (look.kind !== 'ready' || look.signIn.endsAt <= 0) continue;
    const left = look.signIn.endsAt - d.now();
    if (left < SOON) {
      warnings.push(`The saved web sign-in of ${login} ends at ${clock(look.signIn.endsAt)} (in ${Math.max(0, Math.round(left / 60_000))} min)`
        + ' - sign in again in the browser and save it before then; it cannot be renewed by Trova');
    }
  }
  return { refused, warnings };
}

async function bounded(look: () => Promise<string | null>, ms: number, what: string): Promise<string | null> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(`${what} did not answer within ${Math.round(ms / 1000) || 1} s before the run`), ms);
  });
  try {
    return await Promise.race([look().catch((e: unknown) => `${what} could not be checked: ${e instanceof Error ? e.message : String(e)}`), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** "04:05" on this computer's clock */
function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
