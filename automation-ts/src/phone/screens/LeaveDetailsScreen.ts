import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import { ScreenSnapshot } from '../screenSnapshot';
import { detailsOf, isDetailsCard, rightToLeft, ShownLeaveDetails } from './leaveDetails';
import { snackbarOf, SendAnswer } from './snackbarAnswer';

/** the status words a request can show, in the app's two languages */
const STATUS_WORDS = ['Pending', 'تحت الإجراء', 'Approved', 'مقبول', 'Rejected', 'مرفوضة', 'مرفوض'];

/**
 * the trash icon's place on the 1080 px wide realme 7: 148 px in from the card's side, 147 px down (Java deleteOpenedLeave);
 * the app puts it at the row's end - the right in English, the left in Arabic (its package, 2026-11-11)
 */
const TRASH_IN = 148;
const TRASH_DOWN = 147;

/**
 * One request's details on the phone (tapped from its card in My requests) - the TS twin of Java HomeScreen
 * getLeaveDetails / deleteOpenedLeave: the details card (one element whose description holds every line), its status,
 * and the delete - the trash icon has no element of its own, so it is tapped where it sits on the card, then Delete on
 * the "are you sure" question; the app's message is read once (it goes after a few seconds).
 */
export class LeaveDetailsScreen extends PhoneActions {
  private readonly confirmDelete = AppiumBy.xpath("//android.widget.Button[@content-desc='Delete' or @content-desc='حذف']");

  /** the details card: the element whose description has the request's dates (dd/MM/yyyy) */
  private static card(s: ScreenSnapshot): ScreenSnapshot['nodes'][number] | undefined {
    return s.nodes.find((n) => isDetailsCard(n.desc)); // run 720: Arabic digits too
  }

  async details(seconds = 15): Promise<ShownLeaveDetails> {
    const s = await this.lookUntil((x) => LeaveDetailsScreen.card(x) !== undefined, seconds);
    const card = s ? LeaveDetailsScreen.card(s) : undefined;
    if (!s || !card) throw new Error(`The request's details did not show within ${seconds} s`);
    const status = s.nodes.find((n) => STATUS_WORDS.includes(n.desc.trim()))?.desc.trim() ?? '';
    return detailsOf(card.desc, status);
  }

  /** the trash icon on the card (mirrored on a right-to-left card), then Delete on the question; the app's message */
  async delete(): Promise<SendAnswer> {
    const s = await this.lookUntil((x) => LeaveDetailsScreen.card(x) !== undefined, 10);
    const card = s ? LeaveDetailsScreen.card(s) : undefined;
    if (!card) throw new Error('The request\'s details were not on the screen - nothing to delete');
    const [left, top, right] = card.bounds;
    const scale = (right - left) / 1080;
    const x = rightToLeft(card.desc) ? left + Math.round(TRASH_IN * scale) : right - Math.round(TRASH_IN * scale);
    await this.tapAt(x, top + Math.round(TRASH_DOWN * scale), 'Delete request');
    if (!(await this.isPresent(this.confirmDelete, 10))) throw new Error('The app did not ask "are you sure" within 10 s of the trash icon');
    await this.tap(this.confirmDelete, 5, 'Delete (are you sure)');
    const answered = await this.lookUntil((x2) => snackbarOf(x2) !== undefined, 15);
    return (answered && snackbarOf(answered)) ?? { ok: false, text: '' };
  }
}
