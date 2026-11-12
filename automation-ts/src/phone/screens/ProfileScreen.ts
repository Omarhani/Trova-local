import { AppiumBy } from '../../web/by';
import { tapUntilOpened } from '../../core/tapUntilOpened';
import { PhoneActions } from '../phoneActions';

/** My Profile (Java MyProfileScreen): change the password, log out. */
export class ProfileScreen extends PhoneActions {
  private readonly changePasswordButton = AppiumBy.xpath("//android.widget.ImageView[@content-desc=\"Change Password\"]");
  private readonly currentPasswordField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"old_password_text_field\"]");
  private readonly newPasswordField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"new_password_text_field\"]");
  private readonly resetPasswordButton = AppiumBy.xpath("//android.widget.Button[@content-desc=\"Reset my password\"]");
  private readonly backToHomePageButton = AppiumBy.xpath("//android.view.View[@content-desc=\"Back to home page\"]");
  private readonly logOutButton = AppiumBy.xpath("//android.widget.ImageView[@content-desc=\"Logout\" or @content-desc=\"تسجيل الخروج\"]");
  private readonly yesButton = AppiumBy.xpath("//android.widget.Button[@content-desc=\"Yes\" or @content-desc=\"نعم\"]");

  /**
   * Change password - My Profile loads in steps and a tap during its placeholders opened nothing (Jenkins mobPassword
   * #2): tapped again when the form did not open within 3 s (Java tapAgainIfNothingChanged), never a fixed 3 s wait -
   * true when the app confirmed it ("Back to home page").
   */
  async changePassword(current: string, next: string): Promise<boolean> {
    const opened = await tapUntilOpened({
      tap: async () => { if (!(await this.isPresent(this.currentPasswordField, 0))) await this.tap(this.changePasswordButton, 20, 'Change Password'); },
      opened: (seconds) => this.isPresent(this.currentPasswordField, seconds),
    }, 4, 3);
    if (!opened) throw new Error('The change password form did not open within 12 s of tapping Change Password');
    await this.type(this.currentPasswordField, 10, current, 'Current password');
    await this.type(this.newPasswordField, 10, next, 'New password');
    await this.tap(this.resetPasswordButton, 10, 'Reset my password');
    if (!(await this.isPresent(this.backToHomePageButton, 20))) return false;
    await this.tap(this.backToHomePageButton, 10, 'Back to home page');
    return true;
  }

  /** Logout (scrolled to when below the screen) and Yes; back on the sign-in screen with account and server kept */
  async logOut(): Promise<void> {
    // run 651: Logout was below the screen and the 3 s look before the first swipe was lost - now the screen has left
    // "Back to home page" first, then each look waits 1.5 s at most before the next swipe
    await this.lookUntil((s) => !s.has(this.backToHomePageButton), 5);
    for (let swipe = 0; swipe < 3 && !(await this.isPresent(this.logOutButton, 1.5)); swipe++) {
      await this.shell('input', 'swipe', '540', '1600', '540', '600', '300');
    }
    await this.tap(this.logOutButton, 10, 'Logout');
    await this.tap(this.yesButton, 10, 'Yes');
  }
}
