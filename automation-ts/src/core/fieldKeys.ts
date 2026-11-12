/** what the screen shows of a text box: its text, and whether it is a password box (its text then is never read) */
export interface FieldState {
  text: string;
  password: boolean;
}

/** keys for a box whose text is not known: a password box, not read, or showing no text (run 707: a Flutter box hid
 *  "o.hany" from the phone tools - 5 keys left "o") */
export const FULL = 60;
const SPARE = 5;

/**
 * How many delete keys empty the focused box: one for every letter it holds and 5 more, FULL when it is not known.
 * Omar 2026-11-11 (TS phone suite, case 462): select all + delete took ONE letter off a Flutter box ("o.hany" ->
 * "o.han" + the new value) - the box is emptied the way Trova's AI-run tools do it (agent-tools trova-phone-shell
 * clearField), with no 60-key cap so a long box is emptied whole. Part of the shared core.
 */
export function clearCount(field: FieldState | undefined): number {
  return !field || field.password || !field.text ? FULL : [...field.text].length + SPARE;
}

/** the two `adb shell` commands that empty the focused box: from its end, then from its start */
export function clearCommands(keys: number): string[][] {
  return [
    ['input', 'keyevent', 'KEYCODE_MOVE_END', ...Array<string>(keys).fill('KEYCODE_DEL')],
    ['input', 'keyevent', 'KEYCODE_MOVE_HOME', ...Array<string>(keys).fill('KEYCODE_FORWARD_DEL')],
  ];
}

/**
 * The box holds exactly the typed value. A password box, or a box whose text the screen does not show (empty after
 * typing), is not read - its next step proves it.
 */
export function typedRight(field: FieldState | undefined, value: string): boolean {
  if (!field || field.password) return true;
  if (!field.text && value) return true;
  return field.text === value;
}

/** the step's result when the box holds something else: Expected / Actual, never a secret value */
export function wrongField(element: string, value: string, shown: string, secret: boolean): string {
  return secret
    ? `Expected: ${element} holds the typed value / Actual: it holds a different value`
    : `Expected: ${element} shows "${value}" / Actual: it shows "${shown}"`;
}
