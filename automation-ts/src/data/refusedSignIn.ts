import { SlowAnswer } from '../report/failureKind';

/**
 * The refused sign-in cases (Java MobLoginTests / LoginTests): the wrong password is the run's own employee's password
 * with "-wrong" added - never a real account's - and the app's messages Java checks.
 */

/** Java verifyThatUserCannotLoginWithInvalidAccountCode: the app's message holds these words */
export const WRONG_ACCOUNT_CODE_MESSAGE = 'Wrong Account Code or Account not found';

const WRONG_LOGIN_EN = 'The data entered is incorrect, Please check & Try again';
const WRONG_LOGIN_AR = 'البيانات المدخلة غير صحيحة الرجاء التحقق وإعادة المحاولة مرة أخرى';
const ARABIC = /[؀-ۿ]/;

/** the password typed by the wrong password case (Java: employee.password + "-wrong") */
export function wrongPasswordOf(password: string): string {
  return `${password}-wrong`;
}

/** the wrong login message in the app's language: Arabic when the shown one is Arabic, else English (as Java) */
export function expectedWrongLoginMessage(shown: string | undefined): string {
  return shown && ARABIC.test(shown) ? WRONG_LOGIN_AR : WRONG_LOGIN_EN;
}

/**
 * run 860: the sign-in's answer (its HTTP status) after Log in, or undefined when none came within waitS. No answer = the
 * case is not checked (SlowAnswer), never a "no message" failure; an answer = the message check decides, naming it.
 */
export function refusalAnswered(status: number | undefined, waitS: number): string {
  if (status === undefined) throw new SlowAnswer(`The app did not answer the sign-in within ${waitS} s - not the app's answer`);
  return `the app answered the sign-in with ${status}`;
}
