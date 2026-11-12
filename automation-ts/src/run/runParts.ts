/** what a TS run starts before its first block and closes after its last - the real ones in runSetup, fakes in the tests */
export interface RunParts {
  /** the run's own files (sign-ins, refusals, second-try decisions, stops) */
  forgetFiles: () => void;
  /** the run's one browser when it has web blocks; how to close it */
  startBrowser: () => Promise<(() => Promise<void>) | undefined>;
  /** the phone server when it has phone blocks and none runs; how to stop it */
  startPhoneServer: () => Promise<(() => void) | undefined>;
  checkBeforeRun: () => Promise<void>;
  /** the run's phone opened while the earlier blocks run; settles when that is done */
  warmPhone: () => Promise<void>;
  /** the run's kept phone session closed */
  endPhone: () => Promise<void>;
  /** item 10: the run's phone cases stop at once with this reason (the API cases and clean-up still run) */
  stopPhoneCases: (why: string) => void;
  say: (line: string) => void;
}

/** each step in order, every one tried even when one before fails; the first failure is given back after all ran */
async function allOf(steps: Array<() => unknown>): Promise<void> {
  let first: unknown;
  for (const step of steps) {
    try {
      await step();
    } catch (e) {
      first ??= e;
    }
  }
  if (first !== undefined) throw first;
}

/**
 * Item 10 (Test 8094 run 662, "Appium did not start within 60 s" and no test ran): the phone server is a set-up part -
 * tried once more when it does not start; still down = the reason for the phone cases, never the whole run's failure.
 */
async function phoneServer(p: RunParts): Promise<{ stop?: () => void; down?: string }> {
  try {
    return { stop: await p.startPhoneServer() };
  } catch (first) {
    p.say(`The phone server did not start (${words(first)}) - trying once more`);
    try {
      return { stop: await p.startPhoneServer() };
    } catch (again) {
      return { down: `The phone server (Appium) did not start - tried twice (${words(again)}); the phone cases could not run` };
    }
  }
}

function words(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).split(/\r?\n/)[0].trim().slice(0, 200);
}

/**
 * Review R1-21: a run never leaves its browser or phone server running. A set-up step that breaks (the phone server,
 * the before-run check) closes what was already started, then fails the run. At the run's end the phone session, the
 * phone server and the browser are closed FIRST, then the run's files go - a file error never leaves them running.
 */
export async function prepareRun(p: RunParts): Promise<() => Promise<void>> {
  p.forgetFiles(); // a run starts with nothing of an earlier run of the same number
  const closeBrowser = await p.startBrowser();
  let stopPhone: (() => void) | undefined;
  let warming: Promise<void> = Promise.resolve();
  try {
    const phone = await phoneServer(p);
    stopPhone = phone.stop;
    await p.checkBeforeRun();
    if (phone.down) p.stopPhoneCases(phone.down); // after the check, so its own look does not overwrite the reason
    warming = p.warmPhone();
  } catch (e) {
    await allOf([() => stopPhone?.(), () => closeBrowser?.()]);
    throw e;
  }
  // an early phone opening still under way finishes first, so its session is closed too
  return () => allOf([() => warming, p.endPhone, () => stopPhone?.(), () => closeBrowser?.(), p.forgetFiles]);
}
