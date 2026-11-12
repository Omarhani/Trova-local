import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import { ScreenSnapshot } from '../screenSnapshot';

/** My Profile's header shows the user: its full name, then its user name (the app's ProfileHeaderWidget) - any letter case */
export function profileShowsUser(descs: string[], userName: string): boolean {
  const want = userName.trim().toLowerCase();
  return want !== '' && descs.flatMap((d) => d.split('\n')).some((line) => line.trim().toLowerCase() === want);
}

function descs(s: ScreenSnapshot): string[] {
  return s.nodes.map((n) => n.desc).filter(Boolean);
}

/**
 * Who the app is signed in as, read where the app shows it (My Profile's header) - so a kept sign-in of another user
 * (an earlier suite's, or one the server dropped) is never taken for the run's own.
 */
export class SignedInUser extends PhoneActions {
  private readonly myProfileTab = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'My Profile') or contains(@content-desc, 'My profile') or contains(@content-desc, 'حسابي')]");
  private readonly homeTab = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'Home') or contains(@content-desc, 'الرئيسية')]");

  /** My Profile, its header looked at up to seconds: true (and back on Home) when it is userName; false = another user, left on My Profile */
  async is(userName: string, seconds = 10): Promise<boolean> {
    await this.tap(this.myProfileTab, 15, 'My Profile');
    const same = (await this.lookUntil((s) => profileShowsUser(descs(s), userName), seconds)) !== undefined;
    if (same) await this.tap(this.homeTab, 10, 'Home');
    return same;
  }
}
