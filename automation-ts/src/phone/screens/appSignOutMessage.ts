import { AppiumBy } from '../../web/by';
import { ScreenSnapshot } from '../screenSnapshot';

/** the message's title and its one button in the app's two languages (the app's own texts, read from its package 2026-11-11) */
const TITLES = ['Warning !', 'تنبيه !'];
const OK_WORDS = ['Ok', 'حسنًا'];

/** the Ok of the app's sign-out message: the app signs itself out and opens its sign-in screen */
export const SIGN_OUT_OK = AppiumBy.xpath("//android.widget.Button[@content-desc='Ok' or @content-desc='حسنًا']");

/**
 * The message the app shows when its server signed the user out (Test 8094 run 658: "User has been deleted." after a
 * suite deleted the employee still signed in on the phone): the Warning title, the server's words and ONE Ok button -
 * the app's other warnings have more buttons (their Ok opens settings) and are never this. Its words, else undefined.
 */
export function signOutMessageOf(s: ScreenSnapshot): string | undefined {
  const descs = s.nodes.map((n) => n.desc.trim()).filter(Boolean);
  const title = descs.findIndex((d) => TITLES.includes(d));
  if (title < 0) return undefined;
  const buttons = s.nodes.filter((n) => /Button/.test(n.cls) && n.desc.trim() !== '');
  if (buttons.length !== 1 || !OK_WORDS.includes(buttons[0].desc.trim())) return undefined;
  return descs.slice(title + 1).find((d) => !OK_WORDS.includes(d)) ?? '';
}
