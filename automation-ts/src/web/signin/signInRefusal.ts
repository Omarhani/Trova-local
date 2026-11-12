/**
 * A refused sign-in in plain words, with the app's own reason - the TS twin of utils.SignInRefusal (Omar 2026-10-23):
 * "Availo refused: you don't have permission to sign in". Only a wrong user name / password points to Test Data →
 * Credentials; an app API that refuses without its fixed headers points to Test Data → Environments → API headers.
 */

const WRONG_LOGIN = /(invalid|incorrect|wrong|bad).{0,30}(user|password|credential|login)|(user|password|credential).{0,30}(invalid|incorrect|wrong|not match)|كلمة (ال)?مرور|اسم المستخدم|بيانات الدخول (غير|خاطئ)/i;
const NO_PERMISSION = /permission|not allowed|unauthori[sz]ed|forbidden|\b40[13]\b|صلاحي|لا ?تملك|غير مصرح/i;
const HEADERS = /header|service ?key|client ?key|api ?key|request ?version/i;
const CODE_TOO_SOON_AR = /(لا ?يمكن(ك)?|لايمكن(ك)?) ?(إ|ا)عادة (ال)?(إ|ا)رسال.{0,40}(قبل|حتى)/;
const CODE_TOO_SOON = /(cannot|can't|can not|not allowed to) (re-?send|send a new|request a new).{0,40}(before|until|yet)|one-time code cannot be sent before/i;
const PLAIN_ALREADY = /^(\S+ (refused: |did not let )|The sign-in did not get through)/s;
const APP_SAID_NO = /refused the (call|sign-in)|answered HTTP \d+/i;

/** the app's words in Arabic that are common enough to say in English */
const ARABIC: [RegExp, string][] = [
  [/لا ?تملك صلاحية (ل)?تسجيل الدخول/, "you don't have permission to sign in"],
  [/لا ?تملك صلاحية/, "you don't have permission"],
  [/(اسم المستخدم|كلمة (ال)?مرور).*(غير صحيح|خاطئ)/, 'wrong user name or password'],
  [/الحساب (مقفل|موقوف)/, 'the account is locked'],
  [CODE_TOO_SOON_AR, 'a new one-time code cannot be sent before the last one runs out'],
];

/** the app will not send a new one-time code yet (a sign-in just before asked for one) */
export function codeTooSoon(said: string | undefined): boolean {
  return !!said && (CODE_TOO_SOON_AR.test(said) || CODE_TOO_SOON.test(said));
}

/**
 * app: the app's name; said: what it answered ("" when nothing); byApi: the sign-in was an API call (then missing fixed
 * headers are a likely cause); hasHeaders: the environment has fixed API headers.
 */
export function refusalWords(app: string, said: string, byApi: boolean, hasHeaders: () => boolean): string {
  const reason = (said ?? '').replace(/\s+/g, ' ').replace(/^.*?refused the (call( \S+)?|sign-in):\s*/i, '').replace(/^"|"$/g, '').trim();
  const english = ARABIC.find(([p]) => p.test(reason))?.[1] ?? reason;
  const noHeaders = (): boolean => { try { return !hasHeaders(); } catch { return true; } };
  if (!reason) {
    // no app message = it did not get through, never "refused" and never the login's fault
    return `The sign-in did not get through - try again${byApi && noHeaders() ? ' - the app\'s API needs its fixed headers: add them in Test Data → Environments → API headers' : ''}`;
  }
  const who = app.trim() ? app : 'The app';
  const refused = `${who} refused: ${english}${english === reason ? '' : ` ("${reason}")`}`;
  if (WRONG_LOGIN.test(reason)) return `${refused} - fix the login in Test Data → Credentials`;
  if (byApi && noHeaders() && (HEADERS.test(reason) || NO_PERMISSION.test(reason))) {
    return `${refused} - the app's API needs its fixed headers: add them in Test Data → Environments → API headers`;
  }
  return refused;
}

/** an API sign-in's refusal in plain words, once; any other error (or one said plainly already) stays as it is */
export function apiRefusal(app: string, message: string, hasHeaders: () => boolean): string {
  return PLAIN_ALREADY.test(message) || !APP_SAID_NO.test(message) ? message : refusalWords(app, message, true, hasHeaders);
}

/** the app's name from its web address: "https://portal.availo.sa" -> "Availo" */
export function appName(url: string): string {
  try {
    const parts = new URL(url).hostname.split('.');
    let name = parts.length > 1 && /^(www|app|portal|web|test|stage|dev)$/i.test(parts[0]) ? parts[1] : parts[0];
    name = name.replace(/[-_].*$/, '');
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'The app';
  } catch {
    return 'The app';
  }
}
