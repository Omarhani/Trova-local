import { AppiumBy } from '../../web/by';
import { setChecked } from '../../core/checkTap';
import { PhoneActions } from '../phoneActions';
import { nextSignInStep, SignInScreen as Seen, SignInStep } from '../phoneSignInSteps';
import { ScreenSnapshot } from '../screenSnapshot';
import { snackbarOf } from './snackbarAnswer';

const SERVER_BOX = 'server_checkbox_';

/**
 * The app's first screen - account code and server - up to its sign-in form (Java AccountCodeScreen.submitAccountCode):
 * where a new employee taps "employee signup". Each step decides on ONE look at the screen; 60 s at most.
 */
export class AccountCodeScreen extends PhoneActions {
  private readonly accountCodeInput = AppiumBy.xpath("//android.widget.EditText[@resource-id='account_code_text_field']");
  private readonly nextButton = AppiumBy.xpath("//android.widget.Button[@resource-id='account_code_next_button']");
  private readonly usernameField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"username_text_field\"]");
  private readonly homeMark = AppiumBy.xpath("//android.widget.ImageView[@resource-id='checkin_button' or @resource-id='checkout_button']");

  /** account code typed, the run's server ticked, Next - until the sign-in form shows */
  async openSignInForm(accountCode: string, env: string): Promise<void> {
    const done = new Set<string>();
    const until = Date.now() + 60_000;
    while (Date.now() < until) {
      const s = await this.look();
      if (s.has(this.usernameField)) return;
      const step = this.stepOn(s, env, done);
      if (step.kind === 'next') { await this.tap(this.nextButton, 5, 'Next'); await this.lookUntil((x) => !x.has(this.nextButton), 30); }
      else await this.act(step, accountCode, done);
    }
    throw new Error('The app did not show its sign-in form within 60 s of the account code');
  }

  /** Java submitAccountCode: the account code typed, the run's server ticked, Next tapped once - whatever the app answers */
  async submitAccountCode(accountCode: string, env: string): Promise<void> {
    const done = new Set<string>();
    const until = Date.now() + 60_000;
    while (Date.now() < until) {
      const s = await this.look();
      if (s.has(this.usernameField)) throw new Error('The app showed its sign-in form, not its account code screen');
      const step = this.stepOn(s, env, done);
      if (step.kind === 'next') return this.tap(this.nextButton, 5, 'Next');
      await this.act(step, accountCode, done);
    }
    throw new Error('The app did not take its account code within 60 s');
  }

  /** Java getToasterMessageOnce: the app's message once it shows (one look at the screen), "" when none shows */
  async toastOnce(seconds = 10): Promise<string> {
    const s = await this.lookUntil((x) => snackbarOf(x) !== undefined, seconds);
    return (s && snackbarOf(s)?.text) ?? '';
  }

  private stepOn(s: ScreenSnapshot, env: string, done: Set<string>): SignInStep {
    const step = nextSignInStep(this.seen(s), env, done);
    if (step.kind === 'done') throw new Error('The app opened signed in - a new employee needs its first screen');
    if (step.kind === 'stop') throw new Error(step.why);
    return step;
  }

  private async act(step: SignInStep, accountCode: string, done: Set<string>): Promise<void> {
    if (step.kind === 'tick' || step.kind === 'untick') await this.setServer(step.server, step.kind === 'tick');
    else if (step.kind === 'accountCode') { await this.type(this.accountCodeInput, 10, accountCode, 'Account code'); done.add('accountCode'); }
    else await this.pause(200);
  }

  private async setServer(server: string, want: boolean): Promise<void> {
    const id = SERVER_BOX + server;
    const read = async () => (await this.look()).boxes(SERVER_BOX).find((b) => b.id === id);
    const box = await read();
    if (!box) throw new Error(`The app's first screen has no "${server}" server box`);
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
      userName: false,
      password: false,
      next: s.has(this.nextButton),
      login: false,
    };
  }
}
