import { Page } from '@playwright/test';
import { testData } from '../../run/testData';
import { By } from '../by';
import { BasePage } from './base/BasePage';
import { watchToasts } from '../toastWatch';

/**
 * The portal's sign-in page - the TS twin of pages.LoginPage (account code, Next, user name, password, Log in) for the
 * refused sign-in cases. The portal runs in Arabic. The run's own sign-in never comes here (it is made by quick calls).
 */
export class LoginPage extends BasePage {
  private readonly accountCodeInput = By.xpath("//*[@placeholder='رمز الحساب' or @aria-label='رمز الحساب']");
  private readonly nextButton = By.xpath("//button[contains(text(), 'التالي')]");
  private readonly usernameInput = By.xpath("//input[@placeholder='الهاتف أو البريد الإلكتروني']");
  private readonly passwordInput = By.xpath("//input[@placeholder='كلمة السر']");
  private readonly loginButton = By.xpath("//button[contains(text(), 'تسجيل الدخول')]");
  private readonly toaster = By.id('toast-container');
  /** run 860: the app's messages kept from just before the last Next / Log in click */
  private toastsSeen?: (seconds: number) => Promise<string>;

  constructor(page: Page) {
    super(page);
  }

  /** the environment's portal address: a signed-out browser shows the sign-in page there */
  async navigateTo(): Promise<void> {
    await this.open(testData.webUrl());
  }

  async insertAccountCode(accountCode: string): Promise<void> {
    await this.type(this.accountCodeInput, 10, accountCode, 'Account code');
  }

  async clickNext(): Promise<void> {
    this.toastsSeen = await watchToasts(this.page);
    await this.click(this.nextButton, 10, 'Next');
  }

  async insertUsername(userName: string): Promise<void> {
    await this.type(this.usernameInput, 10, userName, 'User name');
  }

  async insertPassword(password: string): Promise<void> {
    await this.type(this.passwordInput, 10, password, 'Password');
  }

  async clickLogin(): Promise<void> {
    this.toastsSeen = await watchToasts(this.page);
    await this.click(this.loginButton, 10, 'Log in');
  }

  /** run 860: Log in, then the status of the app's answer to it (its first POST call after the click), or undefined after waitS */
  async clickLoginAnswered(waitS: number): Promise<number | undefined> {
    const answer = this.page.waitForResponse((r) => r.request().method() === 'POST' && ['xhr', 'fetch'].includes(r.request().resourceType()),
      { timeout: waitS * 1000 }).then((r) => r.status(), () => undefined);
    await this.clickLogin();
    return answer;
  }

  /** Java isToasterVisible: the app's message once it shows within 10 s, "" when none shows - run 860: a message that came
   *  and went after the click counts too (watched from just before it) */
  async toasterMessage(): Promise<string> {
    const seen = this.toastsSeen ? await this.toastsSeen(10) : '';
    return seen || this.messageOf(this.toaster, 1);
  }
}
