import { SlowAnswer } from '../../report/failureKind';

/** what the movements page does for the filter - the page's own steps, fakes in the unit tests */
export interface MovementsSteps {
  /** the loading layer is gone (a few seconds at most): true, else still loading */
  loaded: (seconds: number) => Promise<boolean>;
  /** employee select opened, job number typed, the employee picked, the list closed (Escape) */
  pickEmployee: () => Promise<void>;
  /** ONE click on "Show again" */
  showAgain: () => Promise<void>;
  /** every card is the employee's, or no card for 2 s in a row */
  onlyCardOf: (seconds: number) => Promise<boolean>;
}

const LOAD_S = 60;

function stillLoading(when: string): SlowAnswer {
  return new SlowAnswer(`The movements list - expected: it loads ${when}, seen: still loading after ${LOAD_S} s (the app's answer was slow, not a wrong result)`);
}

/**
 * Java TransactionManagementPage.selectFirstEmployee (run 687): waitUntilLoaded -> pick the employee -> ONE "Show
 * again" (it applies the days and the employee together) -> waitUntilLoaded -> only that employee's card. The app
 * still loading is BLOCKED (SlowAnswer: never a second try of the case).
 */
export async function filterToEmployee(s: MovementsSteps, fullName: string): Promise<void> {
  if (!(await s.loaded(LOAD_S))) throw stillLoading('before the employee is picked');
  await s.pickEmployee();
  await s.showAgain();
  if (!(await s.loaded(LOAD_S))) throw stillLoading('after "Show again"');
  if (!(await s.onlyCardOf(20))) throw new Error(`The movements page did not show only ${fullName}'s card within 20 s`);
}
