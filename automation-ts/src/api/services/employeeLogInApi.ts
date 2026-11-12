import { appAnswer } from '../appAnswer';
import { HttpAnswer } from '../http';
import { PhoneGuestApi } from '../phoneGuestApi';

/** the user info answers 200 once the employee is signed in and approved */
export const SIGNED_IN = 200;

/** the app's words while the admin's approval has not reached the log-in yet */
const UNDER_REVIEW_WORDS = 'طلب الموظف تحت المراجعة';

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * A new employee logs in the way the phone app does (Java AvailoMobileApi.login / loginOk): User/Login with its account,
 * user name and password (never printed), then its user info on the token the log-in answered with.
 */
export class EmployeeLogInApi {
  constructor(private readonly phone: PhoneGuestApi, private readonly waitMs = 3000) {}

  /**
   * User/Login, again every ~3 s while the app still says "under review" (an approval can take a moment to reach the
   * log-in - Java 2026-09-23), at most seconds; keeps the token when it took. ok + the app's own words otherwise.
   */
  async logInWhenApproved(accountId: string, userName: string, password: string, seconds: number): Promise<{ ok: boolean; message: string }> {
    const until = Date.now() + seconds * 1000;
    for (;;) {
      const answer = await this.phone.post('User/Login', { UserName: userName, Password: password, AccountID: accountId });
      const said = appAnswer(answer);
      if (said.ok) {
        this.phone.keepSignedIn(answer);
        return said;
      }
      if (!said.message.includes(UNDER_REVIEW_WORDS) || Date.now() >= until) {
        return { ok: false, message: said.message ? `the app said "${said.message}"` : 'the app gave no reason' };
      }
      await pause(this.waitMs);
    }
  }

  async userInfo(): Promise<HttpAnswer> {
    return this.phone.get('User/UserInfo');
  }
}
