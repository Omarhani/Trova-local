import { AppiumBy } from '../../web/by';
import { NewEmployee } from '../../data/newEmployee';
import { PhoneActions } from '../phoneActions';

/** The app's employee sign-up (Java LoginScreen.clickAddEmployeeButton + RegisterScreen): the form, then the attendance method. */
export class RegisterScreen extends PhoneActions {
  private readonly signUpButton = AppiumBy.xpath("//*[@content-desc=\"تسجيل الموظف\" or @content-desc=\"employee signup\"]");
  private readonly jobNumberField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_job_number_text_field\"]");
  private readonly firstNameField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_first_name_text_field\"]");
  private readonly lastNameField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_last_name_text_field\"]");
  private readonly userNameField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_email_or_phone_text_field\"]");
  private readonly notificationEmailField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_notification_email_text_field\"]");
  private readonly passwordField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_password_text_field\"]");
  private readonly confirmPasswordField = AppiumBy.xpath("//android.widget.EditText[@resource-id=\"register_confirm_password_text_field\"]");
  private readonly nextButton = AppiumBy.xpath("//android.widget.Button[@content-desc=\"Next\"]");
  private readonly attendanceMethodTitle = AppiumBy.xpath("//android.view.View[contains(@content-desc, 'Setup your attendance')]");

  async openSignUp(): Promise<void> {
    await this.tap(this.signUpButton, 30, 'Employee signup');
    if (!(await this.isPresent(this.jobNumberField, 15))) throw new Error('The sign-up form did not open within 15 s');
  }

  /** fills the form in the Java order and taps Next - the password is typed, never shown */
  async fill(e: NewEmployee, password: string, notificationEmail: string): Promise<void> {
    await this.type(this.jobNumberField, 10, e.jobNumber, 'Job number');
    await this.type(this.firstNameField, 10, e.firstName, 'First name');
    await this.type(this.lastNameField, 10, e.lastName, 'Last name');
    await this.type(this.userNameField, 10, e.userName, 'E-mail or phone number');
    await this.type(this.notificationEmailField, 10, notificationEmail, 'Notification e-mail');
    await this.type(this.passwordField, 10, password, 'Password');
    await this.type(this.confirmPasswordField, 10, password, 'Confirm password');
    await this.tap(this.nextButton, 10, 'Next');
  }

  /** "Setup your attendance method" - No biometrics is ticked already - Next; false when the screen never showed */
  async chooseAttendanceMethod(): Promise<boolean> {
    if (!(await this.isPresent(this.attendanceMethodTitle, 20))) return false;
    await this.tap(this.nextButton, 10, 'Next');
    return true;
  }
}
