import { LeaveToSend } from '../../data/leaveToSend';
import { LeaveKind } from '../../data/leaveTypes';
import { AppiumBy } from '../../web/by';
import { PhoneActions } from '../phoneActions';
import { ScreenSnapshot } from '../screenSnapshot';
import { LeaveDatePicker } from './LeaveDatePicker';
import { cardsOf, isPending, LeaveCard, listLoaded, pendingCountOf } from './leaveCards';
import { SendAnswer, snackbarOf } from './snackbarAnswer';

export type { LeaveToSend } from '../../data/leaveToSend';
export type { SendAnswer } from './snackbarAnswer';

/** My requests as one look shows them: the request cards, the Pending counter and every description (counters too) */
export interface MyRequests {
  cards: LeaveCard[];
  pending: number | undefined;
  descs: string[];
}

/**
 * The employee's leave requests on the phone (Self Services > Leave), walked on the realme 7 on Test 2026-11-11 in
 * Arabic and read against the Java HomeScreen (English): My requests with its counters and cards, the new-leave form and
 * its "are you sure" question. Ids first (they are the same in both languages); words in both languages otherwise.
 */
export class LeaveRequestScreen extends PhoneActions {
  private readonly selfServicesTab = AppiumBy.xpath("//android.widget.Button[contains(@content-desc, 'Self Services') or contains(@content-desc, 'الخدمات الذاتية')]");
  private readonly leaveTile = AppiumBy.xpath("//android.widget.ImageView[@content-desc='Leave' or @content-desc='مغادرة']");
  private readonly addButton = AppiumBy.xpath("//android.widget.Button[@resource-id='leave_type_fab_button']");
  private readonly typeDropdown = AppiumBy.xpath("//android.widget.Button[@resource-id='new_leave_sub_type']");
  private readonly fromDateField = AppiumBy.xpath("//android.widget.EditText[@resource-id='new_leave_from_date']");
  private readonly toDateField = AppiumBy.xpath("//android.widget.EditText[@resource-id='new_leave_to_date']");
  private readonly noteField = AppiumBy.xpath("//android.widget.EditText[@resource-id='new_leave_note']");
  private readonly sendButton = AppiumBy.xpath("//android.widget.Button[@resource-id='new_leave_send_button']");
  private readonly sureSendButton = AppiumBy.xpath("//android.widget.Button[@content-desc='Send' or @content-desc='إرسال']");

  /** Self Services > Leave; the app now and then ignores a tap while Self Services settles: up to 3 taps (Java openLeavesScreen) */
  async open(): Promise<void> {
    await this.tap(this.selfServicesTab, 20, 'Self Services');
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.tap(this.leaveTile, 10, 'Leave');
      if (await this.isPresent(this.addButton, 10)) return;
      if (!(await this.isPresent(this.leaveTile, 1))) break; // house rule: tap again only while the tile is still there
    }
    throw new Error('The Leave screen did not open after 3 taps on Leave');
  }

  /** My requests once the list has loaded - its counters AND, when it has requests, its cards (run 640) - at most seconds */
  async myRequests(seconds = 15): Promise<MyRequests> {
    const s = await this.lookUntil((x) => listLoaded(descs(x)), seconds);
    const seen = descs(s ?? (await this.look()));
    return { cards: cardsOf(seen), pending: pendingCountOf(seen), descs: seen };
  }

  /** the request's card once it shows with status Pending; undefined when it did not within seconds */
  async pendingCard(id: string, seconds = 15): Promise<LeaveCard | undefined> {
    const s = await this.lookUntil((x) => cardsOf(descs(x)).some((c) => c.id === id && isPending(c)), seconds);
    return s ? cardsOf(descs(s)).find((c) => c.id === id) : undefined;
  }

  /** taps the request's card ("<id>
<status>
...") - the details open */
  async openRequest(id: string): Promise<void> {
    await this.tap(AppiumBy.xpath(`//android.view.View[starts-with(@content-desc, '${id}
')]`), 15, `Request ${id}`);
  }

  /**
   * the Pending counter once it shows expected (the list reloads after a change); the last number seen, undefined when
   * none showed. noneIsZero (run 778): a list with no pending request shows no counter at all - that reads as 0
   */
  async pendingCountBecomes(expected: number, seconds = 15, noneIsZero = false): Promise<number | undefined> {
    let seen: number | undefined;
    await this.lookUntil((s) => (seen = pendingCountOf(descs(s)) ?? (noneIsZero ? 0 : seen)) === expected, seconds);
    return seen;
  }

  /** + > the type's card > the type > From / To > note > Send > Send again on the question; the app's message */
  async send(leave: LeaveToSend): Promise<SendAnswer> {
    await this.tap(this.addButton, 10, 'Add request');
    await this.tap(byId(`leave_type_fab_card_${leave.kind.categoryId}`), 10, 'Leave');
    await this.chooseType(leave.kind);
    const picker = new LeaveDatePicker(this.phone);
    await picker.pick(this.fromDateField, leave.day, leave.today, 'From date');
    await picker.pick(this.toDateField, leave.day, leave.today, 'To date');
    await this.type(this.noteField, 10, leave.note, 'Notes');
    await this.keyboardAway();
    await this.tap(this.sendButton, 10, 'Send');
    // the question is up when the form's Send has gone: its own Send is the only one left (both say "Send")
    const asked = await this.lookUntil((s) => s.has(this.sureSendButton) && !s.has(this.sendButton), 10);
    if (!asked) throw new Error('The app did not ask "are you sure" within 10 s of Send');
    await this.tap(this.sureSendButton, 5, 'Send (are you sure)');
    return this.answer(15);
  }

  /**
   * the type list, then the type: a tap on the list while the form still slides in is ignored (real phone 2026-11-11) -
   * so the list is tapped again only when its type has not shown (a second tap on an open list would close it); 3 tries
   */
  private async chooseType(kind: LeaveKind): Promise<void> {
    const option = byId(`new_leave_sub_type_${kind.typeId}`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.tap(this.typeDropdown, 10, 'Leave type');
      if (await this.isPresent(option, 3)) {
        await this.tap(option, 5, kind.nameEn || kind.nameAr);
        return;
      }
    }
    throw new Error(`The leave type list did not show "${kind.nameEn || kind.nameAr}" after 3 taps`);
  }

  /** the snackbar the app shows after Send - read once, it goes away after a few seconds */
  private async answer(seconds: number): Promise<SendAnswer> {
    const s = await this.lookUntil((x) => snackbarOf(x) !== undefined, seconds);
    return (s && snackbarOf(s)) ?? { ok: false, text: '' };
  }

  /** the keyboard covers Send: put it away (Escape closes only the keyboard; never Back, which leaves the form) */
  private async keyboardAway(): Promise<void> {
    if (!(await this.phone.isKeyboardShown().catch(() => false))) return;
    await this.shell('input', 'keyevent', '111');
    for (let i = 0; i < 10 && (await this.phone.isKeyboardShown().catch(() => false)); i++) await this.pause(200);
  }
}

function byId(id: string): string {
  return AppiumBy.xpath(`//*[@resource-id='${id}']`);
}

function descs(s: ScreenSnapshot): string[] {
  return s.nodes.map((n) => n.desc).filter(Boolean);
}
