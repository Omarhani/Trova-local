import { ScreenSnapshot } from './screenSnapshot';

/** Android's own permission question: its allow buttons, best first (while the app is used, only this time, allow) */
const ALLOW = ['permission_allow_foreground_only_button', 'permission_allow_one_time_button', 'permission_allow_button']
  .map((id) => `//android.widget.Button[@resource-id='${id}']`);

/** at most this many questions answered for one step (location may ask twice: precise, then while the app is used) */
const MAX_ANSWERS = 3;

/** a step that acts on the question itself (allow, deny) is never answered for it */
const OWN_QUESTION = /permission/i;

/** where the question's allow button is, or undefined when Android asks nothing */
export function allowAt(s: ScreenSnapshot): [number, number] | undefined {
  for (const button of ALLOW) {
    const at = s.middle(button);
    if (at) return at;
  }
  return undefined;
}

type LookUntil = (match: (s: ScreenSnapshot) => boolean, seconds: number) => Promise<ScreenSnapshot | undefined>;
/** answers the question at this point; s = the screen it was seen on (its words name the permission) */
type Allow = (at: [number, number], s: ScreenSnapshot) => Promise<void>;

/**
 * Test 8094 run 870: Android's own permission question (location) covered the app and the step waited for an element
 * under it. A known step, no AI needed: while Android asks, the question is answered "allow" as a person would and the
 * step looks on within its own wait (at most 3 answers). The screen with the element, else undefined.
 */
export async function lookPastQuestions(lookUntil: LookUntil, allow: Allow,
                                        selector: string, seconds: number): Promise<ScreenSnapshot | undefined> {
  const until = Date.now() + seconds * 1000;
  const answers = OWN_QUESTION.test(selector) ? 0 : MAX_ANSWERS;
  for (let answered = 0; ; answered += 1) {
    const asks = answered < answers;
    const s = await lookUntil((x) => x.has(selector) || (asks && allowAt(x) !== undefined), Math.max(0, (until - Date.now()) / 1000));
    if (!s) return undefined;
    const at = asks ? allowAt(s) : undefined; // the question is modal: answered first, even over an element listed under it
    if (!at) return s;
    await allow(at, s);
  }
}
