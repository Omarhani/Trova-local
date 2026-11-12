import { approvedEmployeeOfRun } from '../../../src/api/flows/runEmployeeMaker';
import { NewEmployee } from '../../../src/data/newEmployee';
import { checkEquals, checkTrue } from '../../../src/report/checks';
import { SetUpProblem } from '../../../src/report/failureKind';
import { testData } from '../../../src/run/testData';
import { expectedGreeting } from '../../../src/phone/greeting';
import { Phone } from '../../../src/phone/phoneSession';
import { phoneTest as test } from '../../../src/phone/phoneTest';
import { HealProofScreen } from '../../../src/phone/screens/HealProofScreen';
import { HomeAccount } from '../../../src/phone/screens/HomeAccount';
import { signInAs } from '../employeeAccount/employeeOnPhone';

/**
 * Self-healing proof on the phone (Omar 2026-11-11): each case breaks ONE thing on purpose and must end as designed -
 * 7 our renamed element: AI help gets past, a treatment waits; 8 Android's location question in the way: PASSED (answered
 * as a known step); 9 the phone connection lost mid-case: NOT CHECKED (Blocked); 10 TRAP the phone and the case disagree on a value:
 * FAILED, never healed. The run's employee (made by API) signs in once; nothing is saved in the app.
 */
async function signedIn(phone: Phone): Promise<NewEmployee> {
  const e = await approvedEmployeeOfRun();
  if (!(await new HomeAccount(phone).isShown(20))) await signInAs(phone, e); // set-up: the run's one sign-in on the phone
  return e;
}

test('healPhoneOurRenamedElement', async ({ phone }) => {
  await signedIn(phone);
  const proof = new HealProofScreen(phone);
  // stuck until AI help or a treatment fixes the button's name; healed, it opens My Profile and passes by itself
  await proof.openProfileByRenamedButton();
  checkTrue('Proof · My Profile opened by its button', await proof.profileShows());
});

test('healPhoneLocationQuestionInTheWay', async ({ phone }) => {
  await signedIn(phone);
  const app = testData.mobile().appPackage ?? '';
  const proof = new HealProofScreen(phone);
  await proof.takeLocationBack(app);
  try {
    if (!(await proof.locationQuestionShows(20))) {
      throw new SetUpProblem('Android did not ask for the location after it was taken back - the proof could not put its question in the way');
    }
    await proof.openProfile(); // the question covers home: the step answers it "allow" (a known step, else AI help), then taps
    checkTrue('Proof · My Profile opened after the location question was answered', await proof.profileShows());
  } finally {
    await proof.grantAllAgain(app);
  }
});

test('healPhoneTrapWrongValue', async ({ phone }) => {
  const e = await signedIn(phone);
  const shown = await new HomeAccount(phone).greeting();
  // the trap: the case expects a name the app's server does not have for this employee - a heal may never change it
  checkEquals('Trap · home greets the employee as the case expects', shown, expectedGreeting(shown, `${e.firstName} Trap`));
});

test('healPhoneConnectionLost', async ({ phone }) => {
  await signedIn(phone);
  const proof = new HealProofScreen(phone);
  await proof.endOwnConnection(); // as a phone that drops mid-case; the phone and the app keep running
  await proof.openProfile();
  checkTrue('Proof · My Profile opened with the phone connection lost (it must not)', await proof.profileShows());
});
