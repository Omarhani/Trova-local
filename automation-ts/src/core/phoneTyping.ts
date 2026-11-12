/**
 * Typing on a phone the way the AI-run tools do (platform/agent-tools/trova-phone-type.js; Test 8094 run 585: a value set
 * on a Flutter field never reached the app): plain Latin text without % goes with `input text` as real key presses; any
 * other text through the Unicode keyboard of Appium Settings, switched on only for the typing, the own keyboard put back
 * right after. shell(...args) runs one `adb shell` command on the phone - the caller gives it. Part of the shared core.
 */
export const UNICODE_IME = 'io.appium.settings/.UnicodeIME';
const PIECE = 100;
const REFUSED = 'The phone did not take the text. Tap the field on the phone and try again';

export type Shell = (...args: string[]) => Promise<string>;

/** printable Latin text with no % (`input text` reads %s as a space) */
export function plain(text: string): boolean {
  return /^[\x20-\x24\x26-\x7E]+$/.test(text);
}

export function shellText(text: string): string {
  return text.replace(/([\\"'`$&|;<>()*?!#~{}[\]])/g, '\\$1').replace(/ /g, '%s');
}

/** pieces of at most 100 characters, never cutting one in two, none holding "%s" */
export function pieces(value: string): string[] {
  const out: string[] = [];
  let piece: string[] = [];
  for (const c of [...value]) {
    if (piece.length >= PIECE || (c === 's' && piece[piece.length - 1] === '%')) { out.push(piece.join('')); piece = []; }
    piece.push(c);
  }
  if (piece.length) out.push(piece.join(''));
  return out;
}

/** modified UTF-7 (IMAP) for the Unicode keyboard: printable Latin as it is, & as &-, the rest in &...- runs */
export function utf7(text: string): string {
  const run: number[] = [];
  let out = '';
  const flush = (): void => {
    if (!run.length) return;
    const bytes = Buffer.alloc(run.length * 2);
    run.forEach((code, i) => bytes.writeUInt16BE(code, i * 2));
    out += `&${bytes.toString('base64').replace(/=+$/, '').replace(/\//g, ',')}-`;
    run.length = 0;
  };
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) { flush(); out += code === 0x26 ? '&-' : text[i]; } else run.push(code);
  }
  flush();
  return out;
}

async function typed(shell: Shell, words: string): Promise<void> {
  if (String((await shell('input', 'text', words)) || '').trim()) throw new Error(REFUSED);
}

async function keyboard(shell: Shell): Promise<string> {
  return String((await shell('settings', 'get', 'secure', 'default_input_method')) || '').trim();
}

/** types the text into the focused field */
export async function typeText(shell: Shell, text: string, opts: { wait?: (ms: number) => Promise<void> } = {}): Promise<void> {
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  if (!text) return;
  if (plain(text)) { await typed(shell, shellText(text)); return; }
  const own = await keyboard(shell);
  if (own !== UNICODE_IME && !(await switchTo(shell, wait))) {
    await restore(shell, own);
    throw new Error('This phone cannot type these characters: the Appium Settings app (it comes with the phone test tools) is missing or its keyboard is off');
  }
  try {
    for (const piece of pieces(text)) await typed(shell, shellText(utf7(piece)));
  } finally {
    await restore(shell, own);
  }
}

async function switchTo(shell: Shell, wait: (ms: number) => Promise<void>): Promise<boolean> {
  await shell('ime', 'enable', UNICODE_IME);
  await shell('ime', 'set', UNICODE_IME);
  for (let i = 0; i < 10; i++) {
    if ((await keyboard(shell)) === UNICODE_IME) { await wait(300); return true; }
    await wait(200);
  }
  return false;
}

async function restore(shell: Shell, own: string): Promise<void> {
  if (own && own !== 'null' && own !== UNICODE_IME && (await keyboard(shell)) !== own) await shell('ime', 'set', own);
}
