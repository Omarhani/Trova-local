/**
 * Make automation (round 2): one passed case of an AI run as Trova recorded it - what the AI did per step, the element it
 * used (its locator written the way the page classes write it, e.g. By.xpath("...")), the values by their names
 * ({leave_type_name}) and what it saw. Trova builds it from the run's events; secrets are never in it - a value typed from
 * a saved login is the login's name and field.
 */
export interface MadeRun {
  runId: number;
  caseId: number;
  title: string;
  /** the run's login, by its name in Test Data > Credentials */
  login: string;
  /** how the run signed in and cleaned up: "ui" = through the screens, "hybrid" = by the app's API */
  mode: 'ui' | 'hybrid';
  /** the case's values by name, as the suite keeps them ({run} kept) */
  values: Record<string, string>;
  steps: MadeStep[];
  /** set-up calls done before the steps (by API) */
  setup: MadeAction[];
  /** clean-up: calls by API, or actions on the screens in full screen mode */
  cleanup: MadeAction[];
}

export interface MadeStep {
  /** as written in the case; 0 = the precondition and the sign-in */
  step: number;
  text: string;
  result: string;
  /** the step's expected result as written */
  expected?: string;
  /** texts of the expected result the AI saw on the screen (values by name) */
  saw?: string[];
  actions: MadeAction[];
}

export type MadeAction = WebAction | PhoneAction | ApiAction;

/** a value typed from a saved login: never the value itself */
interface FromLogin {
  login?: string;
  field?: string;
}

export interface WebAction extends FromLogin {
  on: 'web';
  /** the page's address in the app (/invoices) */
  page: string;
  /** the page class Trova linked to that page, when there is one */
  pageClass?: string;
  action: string;
  element?: string;
  locator?: string;
  value?: string;
}

export interface PhoneAction extends FromLogin {
  on: 'phone';
  screen: string;
  screenClass?: string;
  action: string;
  element?: string;
  locator?: string;
  value?: string;
}

export interface ApiAction {
  on: 'api';
  side: 'web' | 'phone';
  method: string;
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** "setup" / "cleanup" for calls that are not the case's own */
  purpose?: string;
  /** the answer's status the AI saw */
  status?: number;
  /** texts the answer held, checked by the AI */
  says?: string[];
  /** value name -> where it is in the answer ({holiday_id: "Data"}) */
  keep?: Record<string, string>;
  /** call as this login instead of the run's */
  as?: string;
}
