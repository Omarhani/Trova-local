import { appAnswer } from '../appAnswer';
import { ok } from '../appApi';
import { HttpAnswer, json } from '../http';
import { PhoneGuestApi } from '../phoneGuestApi';
import { NewEmployee } from '../../data/newEmployee';

/** what the sign-up form takes besides the employee: its password (never printed), notification e-mail, app language */
export interface SignUpExtras {
  password: string;
  notificationEmail: string;
  /** 1 = Arabic, 2 = English (the app shows the employee in it) */
  languageId: number;
}

/** "under review": the app answers the employee's user info with 401 until the admin approves */
export const UNDER_REVIEW = 401;

/**
 * A new employee's own calls on the phone API, the way the Android app makes them (Java AvailoMobileApi): the
 * account id of a code, the sign-up, "no biometrics", the user info. Each answer comes back as the app gave it.
 */
export class EmployeeSignUpApi {
  constructor(private readonly phone: PhoneGuestApi) {}

  /** the account behind an account code (the app sends the bare code as Data) */
  async accountId(accountCode: string): Promise<string> {
    const answer = ok(await this.phone.post('Account/GetAccountIdByCode', accountCode), 'Account/GetAccountIdByCode');
    const id = (answer as { Data?: { ID?: string } } | null)?.Data?.ID;
    if (!id) throw new Error(`The app knows no account with the code ${accountCode}`);
    return String(id);
  }

  /** the sign-up form sent; the employee is signed in by its answer when the app took it */
  async signUp(accountId: string, e: NewEmployee, x: SignUpExtras): Promise<{ ok: boolean; message: string; data: Record<string, unknown> }> {
    const answer = await this.phone.post('User/signup', {
      UserName: e.userName, Password: x.password, AccountID: accountId, FirstName: e.firstName, LastName: e.lastName,
      LanguageID: x.languageId, UserStatesID: null, UserRoles: null, JobNumber: e.jobNumber, DepartmentID: null,
      NotificationEmail: x.notificationEmail,
    });
    const said = appAnswer(answer);
    if (said.ok) this.phone.keepSignedIn(answer);
    return { ...said, data: ((json(answer) as { Data?: Record<string, unknown> } | null)?.Data) ?? {} };
  }

  /** "بدون سمات حيويه" on the attendance set-up screen: the employee waits for the admin (state 0) */
  async chooseNoBiometrics(): Promise<void> {
    const said = appAnswer(await this.phone.post('User/ChangeUserStates', { State: 0, UserID: this.phone.id() }));
    if (!said.ok) throw new Error(`The app refused "no biometrics": ${said.message}`);
  }

  async userInfo(): Promise<HttpAnswer> {
    return this.phone.get('User/UserInfo');
  }

  /** the user info until it answers "under review" (401) - Stage can answer the old state first; 15 s at most */
  async userInfoUnderReview(seconds = 15): Promise<HttpAnswer> {
    const until = Date.now() + seconds * 1000;
    let info = await this.userInfo();
    while (info.status !== UNDER_REVIEW && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 1000));
      info = await this.userInfo();
    }
    return info;
  }
}
