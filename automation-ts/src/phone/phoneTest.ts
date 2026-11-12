import { TestInfo } from '@playwright/test';
import { trovaTest } from '../run/trovaTest';
import { stopFor } from '../run/caseGuard';
import { runStops } from '../run/runStops';
import { blockedSkip } from '../report/blockedSkip';
import { FACTS, LAST_SCREEN } from '../report/failureFacts';
import { screenFactsLine } from './screenFacts';
import { Phone } from './phoneSession';
import { testData } from '../run/testData';
import { watchPhoneLog } from './phoneLogWatch';
import { afterEachCheck } from '../report/checks';
import { PhoneActions } from './phoneActions';
import { startFilm } from './phoneFilmPlayer';
import { BlockMeta } from '../run/blockParams';
import { afterBlock, phoneForBlock } from './phoneForBlock';
import { blockPhoneDeps } from './blockPhoneDeps';
import { phoneFreeOrBlocked } from './phoneFree';
import { waitForEarlyPhone } from './phoneWarmUpDeps';
import { phoneSeen, sayDevice } from '../report/deviceSeen';
import { announcePhone } from './phoneAnnounce';

/**
 * The phone test base: the run's one phone session, kept from block to block (a new session took 9-20 s, Test 8094 runs
 * 633/635), the app reset at the start of each test as a new session starts it - data cleared, or kept when the block
 * says keepAppData=true (it reuses the run's sign-in); a failed test ends the session so the next starts clean. Filmed
 * for the run screen; on a failure the screen's words and its last screen go with the result - the live reporter puts
 * them in the run's console and report (Test 8094 run 585).
 */
export const phoneTest = trovaTest.extend<{ phone: Phone }>({
  phone: async ({ trovaCase }, use, testInfo) => {
    void trovaCase; // after the case's own guard
    const keep = (testInfo.project.metadata as BlockMeta | undefined)?.params?.keepAppData === 'true';
    const stopped = stopFor('phone', runStops.read()); // Round 2 review: only a case that uses the phone stops for it
    if (stopped) blockedSkip(testInfo, 'setup', stopped);
    await waitForEarlyPhone(); // Round 2: the run's phone may be opening while the earlier blocks ran
    const deps = blockPhoneDeps();
    await phoneFreeOrBlocked(testInfo, deps.kept()?.sessionId); // held by something else: 2 min at most, then BLOCKED
    const { phone, filmPort } = await phoneForBlock(keep, deps);
    sayDevice(phoneSeen(phone.capabilities as Record<string, unknown>)); // Round 2: the run shows the phone it used
    announcePhone(phone); // Omar 2026-11-11: Trova's AI help works on this same phone session when a step gets stuck
    const stopFilm = startFilm(filmPort);
    const stopPictures = afterEachCheck(() => PhoneActions.picture(phone)); // a picture after every check too (run 598)
    const stopLog = watchPhoneLog(phone, testData.mobile().appPackage ?? ''); // Problems + Network live (run 608 had none)
    let passed = false;
    try {
      await use(phone);
      passed = testInfo.status === testInfo.expectedStatus;
      if (!passed) await keepFailure(phone, testInfo);
    } finally {
      await stopLog();
      stopPictures();
      stopFilm();
      await afterBlock(phone, passed, deps);
    }
  },
});

async function keepFailure(phone: Phone, testInfo: TestInfo): Promise<void> {
  const xml = await phone.getPageSource().catch(() => '');
  if (xml) await testInfo.attach(FACTS, { body: screenFactsLine(xml), contentType: 'text/plain' });
  const shot = await phone.takeScreenshot().catch(() => '');
  if (shot) await testInfo.attach(LAST_SCREEN, { body: Buffer.from(shot, 'base64'), contentType: 'image/png' });
}
