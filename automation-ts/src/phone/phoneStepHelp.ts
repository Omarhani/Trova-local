import { notPast, stillStuck } from '../run/aiHelp/helpVerdict';
import { stuckWhere, testTitle } from '../run/aiHelp/stuckAt';
import { PhoneAid, PhoneStuck } from './phoneHelpAsk';
import { ScreenSnapshot } from './screenSnapshot';

/** the framework's own phone frames: a stuck phone step is named by the first frame outside them (LoginScreen.signIn) */
const NOT_OURS = /[\\/](node_modules|src[\\/]run[\\/]aiHelp|src[\\/]phone[\\/](phoneActions|phoneStepHelp|phoneHelpAsk)\.ts)[\\/:]|^\s*at (async )?(new )?Promise|node:internal/;

/** the step being waited for: on which screen, which element, by which action */
export interface PhoneWait {
  screen: string;
  element: string;
  selector: string;
  action: string;
  seconds: number;
  /** the stack when the step began (taken before its first wait: a wait leaves only the async frames) */
  stack?: string;
}

/** the screen with the element on it, or why the step stops (said by the caller once the step is on the run page) */
export interface Looked {
  screen?: ScreenSnapshot;
  fail?: Error;
}

/**
 * Self-healing on the phone (Omar 2026-11-11): the element did not show within its wait - AI help is asked (when the run
 * has it) and the screen looked at once more after it got past; the cause decides the failure the same way as a web
 * step (helpVerdict): the app wrong = FAILED, the network or the phone or our own step = BLOCKED.
 */
export async function lookWithHelp(look: (seconds: number) => Promise<ScreenSnapshot | undefined>, aid: PhoneAid, w: PhoneWait): Promise<Looked> {
  const first = await look(w.seconds);
  if (first) return { screen: first };
  const failed = notShown(w);
  const a = await aid(stuckAt(w), failed);
  if (!a) return { fail: failed };
  if (!a.helped) return { fail: notPast(a, failed) };
  const again = await look(w.seconds);
  return again ? { screen: again } : { fail: stillStuck(a, notShown(w)) };
}

function notShown(w: PhoneWait): Error {
  return new Error(notShownWords(w.element, w.seconds));
}

/** a locator, not a name: an XPath or a resource id is never said in a result (run 870) */
const LOCATOR = /^[/(]|@|\/\/|:id\//;

/** "My Profile did not show within 15 s" - the element by its name, never its XPath */
export function notShownWords(element: string, seconds: number): string {
  const name = !element.trim() || LOCATOR.test(element) ? 'The element of this step' : element;
  return `${name} did not show within ${seconds} s`;
}

function stuckAt(w: PhoneWait): PhoneStuck {
  return { screen: w.screen, step: stuckWhere(w.stack, NOT_OURS), test: testTitle(), element: w.element, action: w.action };
}
