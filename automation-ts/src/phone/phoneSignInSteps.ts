/**
 * The phone app's sign-in from whatever screen it starts on (Test 8094 run 576: app data cleared -> the account-code /
 * server screen with Live ticked): what the screen shows decides the next step, the same order the AI-run phone sign-in
 * uses - the run's server box, the account code, user name + password, log in. Already on home = nothing to do.
 */
export interface SignInScreen {
  home: boolean;
  servers: { name: string; checked: boolean }[];
  accountCode: boolean;
  userName: boolean;
  password: boolean;
  next: boolean;
  login: boolean;
  /** Android's own permission question is up (run 645: location, after the app's data was cleared) */
  permission?: boolean;
  /** a message the app shows that is not a success one (after Log in: its refusal) */
  refused?: string;
  /** the app's own sign-out message is up (its server dropped the user - run 658: "User has been deleted.") */
  signedOutMessage?: string;
}

export type SignInStep =
  | { kind: 'done' } | { kind: 'wait' } | { kind: 'accountCode' } | { kind: 'credentials' } | { kind: 'next' } | { kind: 'login' }
  | { kind: 'allow' } | { kind: 'dismiss' } | { kind: 'verify' } | { kind: 'tick'; server: string } | { kind: 'untick'; server: string }
  | { kind: 'stop'; why: string };

/**
 * done: the steps already taken on this sign-in ("accountCode", "credentials", "login", "verified"). A foreign state
 * first (run 658): the app's sign-out message is closed with its Ok; a home this sign-in did not log in to is checked
 * for its user (another user = signed out, then the sign-in goes on).
 */
export function nextSignInStep(s: SignInScreen, env: string, done: Set<string>): SignInStep {
  if (s.permission) return { kind: 'allow' };
  if (s.signedOutMessage !== undefined) return { kind: 'dismiss' };
  if (s.home) return done.has('login') || done.has('verified') ? { kind: 'done' } : { kind: 'verify' };
  if (s.refused && done.has('login')) {
    return { kind: 'stop', why: `The app refused the sign-in: "${s.refused}" - check the login in Test Data > Credentials` };
  }
  if (s.servers.length > 0) {
    const want = s.servers.find((b) => b.name.trim().toLowerCase() === env.trim().toLowerCase());
    if (!want) return { kind: 'stop', why: `The app has no server called "${env}" (it shows ${s.servers.map((b) => b.name).join(', ')})` };
    if (!want.checked) return { kind: 'tick', server: want.name };
    const other = s.servers.find((b) => b !== want && b.checked);
    if (other) return { kind: 'untick', server: other.name };
  }
  if (s.accountCode && !done.has('accountCode')) return { kind: 'accountCode' };
  if (s.userName && !done.has('credentials')) return { kind: 'credentials' };
  if (s.userName && s.login) return { kind: 'login' };
  if (s.next) return { kind: 'next' };
  return { kind: 'wait' };
}
