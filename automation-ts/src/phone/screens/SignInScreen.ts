import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import type { Phone } from '../phoneSession';
import { setChecked } from '../../core/checkTap';
import { appSignInExtra, nextSignInStep, SignInScreen as Seen, SignInStep } from '../phoneSignInSteps';
import { signInStep } from '../../records/signInLine';
import { ScreenSnapshot } from '../screenSnapshot';
import { phoneSignInOnce } from '../phoneSignInOnce';
import { SIGN_OUT_OK, signOutMessageOf } from './appSignOutMessage';
import { ProfileScreen } from './ProfileScreen';
import { SignedInUser } from './SignedInUser';

/** what a login gives the phone sign-in */
export interface PhoneLogin {
  accountCode: string;
  userName: string;
  password: string;
}

const SERVER_BOX = 'server_checkbox_';

/**
 * The phone app's sign-in screens (account code + server boxes, user name + password) read as they come - any start
 * screen, or home when the app is already signed in (Test 8094 run 576) and it is the login's own user (My Profile; another
 * user is signed out first - run 658), or the app's own sign-out message (closed with Ok). Each step decides on ONE look
 * at the screen (runs 587/588). 90 s at most; the same step 3 times = stop.
 */
export class SignInScreen extends PhoneActions {
  private readonly accountCodeInput = AppiumBy.xpath("//android.widget.EditText[@resource-id='account_code_text_field']");
  private readonly nextButton = AppiumBy.xpath("//android.widget.Button[@resource-id='account_code_next_button']");
  private readonly usernameField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"username_text_field\"]");
  private readonly passwordField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"password_text_field\"]");
  private readonly loginButton = AppiumBy.xpath("//*[@resource-id=\"login_button\"]");
  private readonly homeMark = AppiumBy.xpath("//android.widget.ImageView[@resource-id='checkin_button' or @resource-id='checkout_button']");
  // Android's permission question (location): allow while the app is used, else only this time
  private readonly allowButton = AppiumBy.xpath("//android.widget.Button[@resource-id='permission_allow_foreground_only_button' or @resource-id='permission_allow_one_time_button']");

  /** item 9: ONE sign-in per login and run - after a failure the later cases of the login stop at once */
  async signIn(login: PhoneLogin, env: string): Promise<void> {
    return phoneSignInOnce(login.userName, async () => {
      const done = await this.signInSteps(login, env);
      signInStep(login.userName, 'app', appSignInExtra(done)); // rule 3: the user and the way
    });
  }

  private async signInSteps(login: PhoneLogin, env: string): Promise<Set<string>> {
    const done = new Set<string>();
    const until = Date.now() + 90_000;
    let last = '';
    let same = 0;
    while (Date.now() < until) {
      const step = nextSignInStep(this.seen(await this.look()), env, done);
      if (step.kind === 'done') return done;
      if (step.kind === 'stop') throw new Error(step.why);
      const key = JSON.stringify(step);
      same = key === last ? same + 1 : 0;
      last = key;
      if (same >= 2 && step.kind !== 'wait') throw new Error(`The phone sign-in did not move on after "${step.kind}" 3 times`);
      await this.act(step, login, done);
    }
    throw new Error('The phone app did not reach its home screen within 90 s of the sign-in');
  }

  private async act(step: SignInStep, login: PhoneLogin, done: Set<string>): Promise<void> {
    switch (step.kind) {
      case 'tick': case 'untick': await this.setServer(step.server, step.kind === 'tick'); break;
      case 'accountCode':
        // no read-back: a Flutter box never gives its text to the phone tools (run 586) - the next screen proves it
        await this.type(this.accountCodeInput, 10, login.accountCode, 'Account code');
        done.add('accountCode');
        break;
      case 'credentials':
        await this.type(this.usernameField, 10, login.userName, 'User name');
        await this.type(this.passwordField, 10, login.password, 'Password');
        done.add('credentials');
        break;
      case 'next': await this.goOn(this.nextButton, 'Next'); break;
      case 'login': await this.goOn(this.loginButton, 'Log in'); done.add('login'); break;
      case 'allow': await this.tap(this.allowButton, 5, 'Allow (location)'); break;
      case 'dismiss': await this.closeSignOutMessage(); break;
      case 'verify': await this.keepOnlyTheLogin(login.userName, done); break;
      default: await this.pause(200);
    }
  }

  /**
   * Java LoginScreen.login: user name, password, Log in - and nothing more (no wait for home): the refused sign-in cases
   * read the app's answer themselves. Never the run's one sign-in (a refusal here is the case's expected result).
   */
  async submitLogin(userName: string, password: string): Promise<void> {
    await this.type(this.usernameField, 30, userName, 'User name'); // shows once the server took the account code
    await this.type(this.passwordField, 10, password, 'Password');
    await this.tap(this.loginButton, 10, 'Log in');
  }

  /** the sign-in screen is up (the account code or the user name box) within seconds */
  async isShown(seconds: number): Promise<boolean> {
    return (await this.lookUntil((s) => s.has(this.accountCodeInput) || s.has(this.usernameField), seconds)) !== undefined;
  }

  /**
   * run 718: the app, once started (at most 25 s), shows its sign-in screen - true; its home or another screen first,
   * or nothing within 25 s - false (the block then starts the app again as before)
   */
  static async startsOnSignIn(phone: Phone): Promise<boolean> {
    const screen = new SignInScreen(phone);
    const s = await screen.lookUntil((x) => x.has(screen.accountCodeInput) || x.has(screen.usernameField) || x.has(screen.homeMark), 25);
    return !!s && !s.has(screen.homeMark);
  }

  /** the app's own sign-out message, when it is up: Ok (the app opens its sign-in screen); true when there was one */
  async closeSignOutMessage(): Promise<boolean> {
    const message = signOutMessageOf(await this.look());
    if (message === undefined) return false;
    console.log(`The app had been signed out by its server ("${message}") - closing its message with Ok`);
    await this.tap(SIGN_OUT_OK, 5, 'Ok (signed out)');
    await this.lookUntil((s) => signOutMessageOf(s) === undefined, 10);
    return true;
  }

  /** a kept sign-in: My Profile shows the login's user = kept; another user = signed out first (Logout, Yes) */
  private async keepOnlyTheLogin(userName: string, done: Set<string>): Promise<void> {
    if (await new SignedInUser(this.phone).is(userName)) {
      done.add('verified');
      return;
    }
    console.log(`The app was signed in as another user - signing it out, then signing in as ${userName}`);
    await new ProfileScreen(this.phone).logOut();
    await this.isShown(20);
  }

  /** taps and waits (up to 30 s) until the app answered: the button left the screen */
  private async goOn(button: string, name: string): Promise<void> {
    await this.tap(button, 5, name);
    await this.lookUntil((s) => !s.has(button), 30);
  }

  /** the run's server box ticked (or another one unticked) the AI-run way, and seen (core/checkTap) */
  private async setServer(server: string, want: boolean): Promise<void> {
    const id = SERVER_BOX + server;
    const read = async () => (await this.look()).boxes(SERVER_BOX).find((b) => b.id === id);
    const box = await read();
    if (!box) throw new Error(`The phone sign-in screen has no "${server}" server box`);
    await setChecked(box, want, {
      read,
      wait: () => this.pause(200),
      tap: async (x, y) => { await this.shell('input', 'tap', String(x), String(y)); },
    });
  }

  private seen(s: ScreenSnapshot): Seen {
    return {
      home: s.has(this.homeMark),
      servers: s.boxes(SERVER_BOX).map((b) => ({ name: b.id.slice(SERVER_BOX.length), checked: b.checked })),
      accountCode: s.has(this.accountCodeInput),
      userName: s.has(this.usernameField),
      password: s.has(this.passwordField),
      next: s.has(this.nextButton),
      login: s.has(this.loginButton),
      permission: s.has(this.allowButton),
      refused: s.nodes.find((n) => /snackbar/i.test(n.id) && !/success/i.test(n.id) && (n.desc || n.text))?.desc || undefined,
      signedOutMessage: signOutMessageOf(s),
    };
  }
}
