import * as fs from 'node:fs';
import appiumSetup from '../phone/appiumSetup';
import { needsPhone } from '../phone/appiumServer';
import { runEndDeps } from '../phone/blockPhoneDeps';
import { endKeptPhone } from '../phone/phoneForBlock';
import { startPhoneWarmUp } from '../phone/phoneWarmUpDeps';
import { browserSeen, sayDevice } from '../report/deviceSeen';
import { emit } from '../report/liveEvents';
import { runSignIns } from '../signin/runSignIns';
import { runSignInBook } from '../signin/runSignInBook';
import { pickedBrowser } from '../web/browserChoice';
import { startSharedBrowser } from '../web/sharedBrowser';
import { checkBeforeRun } from './preRunApply';
import { retryBook } from './retryBook';
import { prepareRun } from './runParts';
import { runStops } from './runStops';
import { needsWeb, parseSuite, SuitePlan } from './suitePlan';

/** the run's browser (when it has web blocks), said on the run screen (Round 2: the Runs list shows it) */
async function browserFor(plan: SuitePlan | undefined): Promise<(() => Promise<void>) | undefined> {
  if (plan) process.env.TROVA_BROWSER = pickedBrowser(process.env, plan.params); // the suite's browser parameter when the run names none
  if (!plan || !needsWeb(plan)) return undefined;
  const close = await startSharedBrowser();
  sayDevice(browserSeen(process.env.TROVA_BROWSER));
  return close;
}

/** Round 2 speed: the phone opened while the earlier blocks run - never when the pre-run check stopped it */
function warmUp(plan: SuitePlan | undefined): Promise<void> {
  const stops = runStops.read();
  return plan && !stops.app && !stops.phone && needsPhone(plan) ? startPhoneWarmUp(plan) : Promise.resolve();
}

/**
 * Before the first block of a TS suite (Playwright's global set-up): the run's one browser when it has web blocks, the
 * phone server when it has phone blocks - each kept for the whole suite as the Java suites keep theirs - then the run's
 * one pre-run check (Round 2), and what to close after the last block (runParts: never left running).
 */
export default async function runSetup(): Promise<() => Promise<void>> {
  const file = process.env.TROVA_SUITE_FILE?.trim();
  const plan = file ? parseSuite(fs.readFileSync(file, 'utf8')) : undefined;
  return prepareRun({
    forgetFiles: () => { runSignIns.forget(); runSignInBook.forget(); retryBook.forget(); runStops.forget(); },
    startBrowser: () => browserFor(plan),
    startPhoneServer: async () => (plan && needsPhone(plan) ? appiumSetup() : undefined),
    checkBeforeRun: async () => { if (plan) await checkBeforeRun(plan); }, // once, 10 s at most
    warmPhone: () => warmUp(plan),
    endPhone: () => endKeptPhone(runEndDeps()), // the phone free for the next user
    stopPhoneCases: (why) => runStops.save({ ...runStops.read(), phone: why }),
    say: (line) => emit('note', { text: line }),
  });
}
