import { AppiumBy } from '../../web/by';
import { onPhone } from '../phoneGone';
import { appiumAddress } from '../phoneSession';
import { PhoneActions } from '../phoneActions';

/** the app's location permissions - taken back for case 8 so Android asks again */
const LOCATION = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'];

/**
 * Self-healing proof on the phone (Omar 2026-11-11): the app's home with one thing broken ON PURPOSE per case - our
 * renamed My Profile button, Android's location question in the way, the test's own phone connection ended. Used only
 * by the phone proof suite (tests/mobile/healProof) - here so a treatment of its renamed button is allowed and proven
 * like any screen class. Nothing is saved in the app; the phone itself is never switched off or cut from its network.
 */
export class HealProofScreen extends PhoneActions {
  /** the real button is "My Profile" - this name is wrong on purpose (case 7) */
  private readonly renamedMyProfileButton = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'My Old Profile')]");
  private readonly myProfileButton = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'My Profile')]");
  private readonly changePasswordButton = AppiumBy.xpath("//android.widget.ImageView[@content-desc=\"Change Password\"]");
  private readonly locationQuestion = AppiumBy.xpath("//android.widget.Button[contains(@resource-id, 'com.android.permissioncontroller:id/permission_allow')]");

  /** case 7: My Profile by a name the app does not have; stuck until AI help or a treatment gets past it */
  async openProfileByRenamedButton(): Promise<void> {
    await this.tap(this.renamedMyProfileButton, 15, 'My Profile (renamed on purpose)');
  }

  /** case 8: My Profile by its real name - Android's location question may be over it */
  async openProfile(): Promise<void> {
    await this.tap(this.myProfileButton, 15, 'My Profile');
  }

  /** My Profile has opened: its Change Password shows (20 s - the screen loads in steps) */
  async profileShows(): Promise<boolean> {
    return this.isPresent(this.changePasswordButton, 20);
  }

  /** case 8 set-up: the app's location permission taken back and the app opened again, so Android asks for it */
  async takeLocationBack(appId: string): Promise<void> {
    await this.command('mobile: changePermissions', { permissions: LOCATION, appPackage: appId, action: 'revoke' });
    await this.command('mobile: terminateApp', { appId });
    await this.command('mobile: activateApp', { appId });
  }

  /** case 8: Android's location question is up (seconds at most) - the case's trap is set only then */
  async locationQuestionShows(seconds: number): Promise<boolean> {
    return this.isPresent(this.locationQuestion, seconds);
  }

  /** case 8 clean-up: every permission of the app granted again, as a new session starts it */
  async grantAllAgain(appId: string): Promise<void> {
    await this.command('mobile: changePermissions', { permissions: 'all', appPackage: appId, action: 'grant' });
  }

  /**
   * case 9: the test ends its OWN phone connection mid-case, as when the phone drops - the safe way to prove it ends Not
   * checked: no airplane mode, no Wi-Fi or cable switch, the phone and the app keep running. Ended at the phone server
   * (Appium) itself, so the next step meets a lost session as in a real drop (the driver would only refuse to send it).
   */
  async endOwnConnection(): Promise<void> {
    const a = appiumAddress();
    const at = `http://${a.hostname}:${a.port}${a.path.replace(/\/$/, '')}/session/${this.phone.sessionId}`;
    const r = await fetch(at, { method: 'DELETE', signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`The proof could not end its own phone connection (the phone server answered ${r.status})`);
  }

  private async command(name: string, args: Record<string, unknown>): Promise<void> {
    await onPhone(() => this.phone.execute(name, args));
  }
}
