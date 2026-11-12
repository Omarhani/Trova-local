import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';

/** "أهلا Omar" / "Welcome Omar" - \b does not work after Arabic letters */
const GREETING = /^(أهلا|Welcome)(\s|$)/;

/** The app's home as the employee's own (Java HomeScreen): the greeting, the pending home's tour, My Profile. */
export class HomeAccount extends PhoneActions {
  private readonly takeTourButton = AppiumBy.xpath("//*[@content-desc='Take a tour']");
  private readonly welcomeMessage = AppiumBy.xpath("//android.view.View[contains(@content-desc, 'أهلا') or contains(@content-desc, 'Welcome')]");
  private readonly myProfileButton = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'My Profile')]");
  private readonly selfServicesButton = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'Self Services') or contains(@content-desc, 'الخدمات الذاتية')]");

  /** the pending home after a registration: its "Take a tour" (15 s) */
  async takeTourShown(): Promise<boolean> {
    return this.isPresent(this.takeTourButton, 15);
  }

  /** the signed-in home: its Self Services tab (seconds at most) */
  async isShown(seconds = 20): Promise<boolean> {
    return this.isPresent(this.selfServicesButton, seconds);
  }

  /** the greeting home shows ("Welcome Omar"), read from one look; '' when none showed within 15 s */
  async greeting(): Promise<string> {
    const s = await this.lookUntil((x) => x.has(this.welcomeMessage), 15);
    const node = s?.nodes.find((n) => GREETING.test(n.desc.trim()));
    return (node?.desc ?? '').trim();
  }

  async openMyProfile(): Promise<void> {
    await this.tap(this.myProfileButton, 15, 'My Profile');
  }

  /** closes the app and opens it again from its kept data, as a person does (no sign-in step) */
  async reopenApp(appPackage: string): Promise<void> {
    await this.phone.execute('mobile: terminateApp', { appId: appPackage });
    await this.phone.execute('mobile: activateApp', { appId: appPackage });
  }
}
