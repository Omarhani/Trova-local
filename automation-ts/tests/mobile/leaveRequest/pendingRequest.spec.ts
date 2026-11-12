import { LEAVE_PENDING } from '../../../src/api/services/leaveRequestsApi';
import { accountClock } from '../../../src/data/appClock';
import { dmy, ymd } from '../../../src/data/leaveDay';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { Phone } from '../../../src/phone/phoneSession';
import { PENDING_WORDS, sameEmployee } from '../../../src/phone/screens/leaveCards';
import { LeaveDetailsScreen } from '../../../src/phone/screens/LeaveDetailsScreen';
import { isOneDay } from '../../../src/phone/screens/leaveDetails';
import { LeaveRequestScreen, MyRequests } from '../../../src/phone/screens/LeaveRequestScreen';
import { leaveNoteKey } from '../../../src/data/leaveNotesOfRun';
import { NewEmployee } from '../../../src/data/newEmployee';
import { employeeLeaves, leaveEmployee, MADE_NOTES, openAppAs, signInAgainAsTheEmployee } from './leaveOnPhone';
import { goneFromList, sentByApi } from './sentByApi';

/**
 * A request still Pending, on the phone - the TS twins of Java mob/mobLeaveRequest (LeaveRequestsTests
 * verifyThatNewEmployeeCanSubmitLeaveAndSeeItsDetailsInPending - its details part - and verifyThatEmployeeCanDeletePendingLeave;
 * 4/4 on Test and Stage, 2026-09-26). Hybrid: the request is the case's own, sent by the employee's API (set-up); the
 * app opens with the run's kept sign-in; the clean-up deletes by API what is left.
 */

/** Leave with My requests loaded as the employee's own (else the run's one sign-in on the screens first) */
async function myRequestsAsTheEmployee(phone: Phone, e: NewEmployee, screen: LeaveRequestScreen, rows: { ID: number; StatusId: number }[]): Promise<MyRequests> {
  await openAppAs(phone, e);
  await screen.open();
  const shown = await screen.myRequests();
  if (sameEmployee(shown.descs, rows)) return shown;
  await signInAgainAsTheEmployee(phone, e);
  await screen.open();
  return screen.myRequests();
}

test('testVerifyThatThePendingRequestShowsItsDetailsInTheApp', async ({ phone }) => {
  const e = await leaveEmployee();
  const leaves = await employeeLeaves(e);
  const { row, toSend, sentAt } = await sentByApi(leaves, e);
  console.log(`Pre-condition - API: request ${row.ID} sent for ${ymd(toSend.day)} (the employee's next free working day)`);
  const screen = new LeaveRequestScreen(phone);
  await myRequestsAsTheEmployee(phone, e, screen, await leaves.list());
  checkTrue(`My requests · request ${row.ID} shows as Pending`, (await screen.pendingCard(String(row.ID))) !== undefined);

  await screen.openRequest(String(row.ID));
  const details = await new LeaveDetailsScreen(phone).details();
  const names = [toSend.kind.nameEn, toSend.kind.nameAr].filter(Boolean);
  checkEquals('Details · request id (same as the card)', details.id, String(row.ID));
  checkTrue(`Details · type is ${names.join(' / ')}`, names.some((n) => details.type.includes(n)), `seen "${details.type}"`);
  checkTrue('Details · status is Pending', PENDING_WORDS.includes(details.status), `seen "${details.status}"`);
  checkEquals('Details · start - end', `${details.start} - ${details.end}`, `${dmy(toSend.day)} - ${dmy(toSend.day)}`);
  // the day it was sent on the app's own clock (run 1025: 23:05 here was already 13/11 for the app), never the computer's
  checkEquals('Details · submission date', details.submitted, dmy(accountClock.wallAt(sentAt)));
  checkTrue('Details · request duration is one day', isOneDay(details.duration), `seen "${details.duration}"`); // run 720: Arabic too
  checkEquals('Details · notes', details.notes, toSend.note);
});

test('testVerifyThatTheEmployeeCanDeleteAPendingRequestInTheApp', async ({ phone }) => {
  const e = await leaveEmployee();
  const leaves = await employeeLeaves(e);
  const { row, toSend } = await sentByApi(leaves, e);
  console.log(`Pre-condition - API: request ${row.ID} sent for ${ymd(toSend.day)} (the employee's next free working day)`);
  const screen = new LeaveRequestScreen(phone);
  const listed = await leaves.list();
  await myRequestsAsTheEmployee(phone, e, screen, listed);
  checkTrue(`My requests · request ${row.ID} shows as Pending`, (await screen.pendingCard(String(row.ID))) !== undefined);
  // run 778: the count shows once the list has loaded the request - read it then, against the employee's own Pending by API
  const pendingByApi = listed.filter((r) => r.StatusId === LEAVE_PENDING).length;
  const before = { pending: await screen.pendingCountBecomes(pendingByApi) };
  checkEquals("My requests · the Pending count is the employee's own (by API)", before.pending, pendingByApi);

  await screen.openRequest(String(row.ID));
  const answer = await new LeaveDetailsScreen(phone).delete();
  checkTrue('Delete · the app says the request was deleted', answer.ok, answer.text ? `the app said "${answer.text}"` : 'no message');
  const expected = (before.pending ?? 0) - 1;
  checkEquals('My requests · the Pending count went down by 1', await screen.pendingCountBecomes(expected, 15, expected === 0), expected); // 0 = no count shown
  const gone = await goneFromList(leaves, toSend.note);
  checkTrue("API · the request is gone from the employee's own list", gone, `request ${row.ID} is still listed`);
  if (gone) runRecords.forget(MADE_NOTES, leaveNoteKey(e.userName, toSend.note));
});
