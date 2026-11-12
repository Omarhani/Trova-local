import { LEAVE_PENDING, leaveRecords } from '../../../src/api/services/leaveRequestsApi';
import { ymd } from '../../../src/data/leaveDay';
import { cleanUpMade } from '../../../src/run/cleanUpMade';
import { runRecords } from '../../../src/run/runRecords';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { countersOf, sameEmployee } from '../../../src/phone/screens/leaveCards';
import { LeaveRequestScreen } from '../../../src/phone/screens/LeaveRequestScreen';
import { leaveNoteKey, notesByEmployee } from '../../../src/data/leaveNotesOfRun';
import { runEmployees } from '../../../src/run/runEmployee';
import { employeeLeaves, leaveEmployee, leavePlan, MADE_NOTES, openAppAs, sentRow, signInAgainAsTheEmployee } from './leaveOnPhone';

/**
 * Send a leave request from the phone app - the TS twin of Java mob/mobLeaveRequest on the employee this run made by API
 * (Java makes its own for each run). Hybrid: the employee signs in ONCE by the phone app's API for the set-up and the
 * clean-up; the app opens with its kept sign-in (one sign-in on its screens only when it has none). Pass = the request
 * is seen as sent and Pending in the app AND in the employee's own list by API.
 */
test('testVerifyThatAnEmployeeCanSendALeaveRequestFromThePhoneApp', async ({ phone }) => {
  const e = await leaveEmployee();
  const leaves = await employeeLeaves(e);
  const { toSend, rows } = await leavePlan(leaves);
  console.log(`Pre-condition - API Leaves/AllLeaves: a free working day picked (${ymd(toSend.day)}), type ${toSend.kind.nameEn}`);

  await openAppAs(phone, e);
  const screen = new LeaveRequestScreen(phone);
  await screen.open();
  let before = await screen.myRequests();
  const proven = sameEmployee(before.descs, rows);
  if (!proven) {
    await signInAgainAsTheEmployee(phone, e); // the run's one sign-in on the screens: the app is the employee from here
    await screen.open();
    before = await screen.myRequests();
  }
  // run 778: the run's own new employee has no request - the app shows no Pending count at all; by API that is Pending 0
  if (before.pending === undefined && rows.length === 0) before = { ...before, pending: 0 };
  checkTrue('My requests · the list and its Pending count show (none yet = 0, by API)', before.pending !== undefined);
  // never send as someone else (run 640 sent as the app's earlier employee): counters and cards = the employee's own list
  // after the run's own sign-in an employee with no request shows 0 / 0 / 0; one with requests matches its list
  const matches = rows.length ? sameEmployee(before.descs, rows) : Object.values(countersOf(before.descs)).every((n) => n === 0);
  checkTrue(`My requests · the app is signed in as ${e.userName}`, matches,
    'its requests are not the employee\'s own list');

  runRecords.keep(MADE_NOTES, leaveNoteKey(e.userName, toSend.note)); // from here the request may exist - the clean-up looks for it
  const answer = await screen.send(toSend);
  checkTrue('Send · the app says the request was sent', answer.ok, answer.text ? `the app said "${answer.text}"` : 'no message');

  const row = await sentRow(leaves, toSend.note);
  checkTrue('API · the employee\'s own list has the request', row !== undefined, `no request with the note "${toSend.note}"`);
  checkEquals('API · the request is Pending', row?.StatusId, LEAVE_PENDING);
  checkEquals('API · the request is on the leave day', `${row?.FromDate.slice(0, 10)} - ${row?.ToDate.slice(0, 10)}`,
    `${ymd(toSend.day)} - ${ymd(toSend.day)}`);

  const card = await screen.pendingCard(String(row?.ID));
  checkTrue(`My requests · request ${row?.ID} shows as Pending`, card !== undefined);
  checkEquals('My requests · the Pending count went up by 1', (await screen.myRequests(5)).pending, (before.pending ?? 0) + 1);
});

/**
 * deletes by the employee's API only the requests this run sent (found by their note) and checks each is gone - before
 * the employee itself is deleted; a request of an employee the run no longer has stays listed as left
 */
test('cleanUpLeaveRequestsProgrammatically', async () => {
  const made = runRecords.newestFirst(MADE_NOTES);
  test.skip(made.length === 0, 'Nothing was sent by this run - nothing to delete');
  const left: string[] = [];
  for (const [userName, notes] of notesByEmployee(made)) {
    const e = runEmployees.current();
    if (e?.userName !== userName) {
      left.push(...notes);
      continue;
    }
    const gone = (note: string) => runRecords.forget(MADE_NOTES, leaveNoteKey(userName, note));
    left.push(...await cleanUpMade(notes, leaveRecords(await employeeLeaves(e)), gone));
  }
  checkTrue(`Clean-up · the ${made.length} leave request(s) this run sent are gone from the employee's list`, left.length === 0,
    left.length ? `still listed: ${left.join(', ')}` : '');
});
