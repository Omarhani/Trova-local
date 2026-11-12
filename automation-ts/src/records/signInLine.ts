/** how a sign-in was made: the app's own calls, or its sign-in screens */
export type SignInWay = 'api' | 'screens';

/** Rule 3 (Omar 2026-11-13): every sign-in step names the user and the way - "Sign in as Admin (by API)" */
export function signInLine(login: string, way: SignInWay): string {
  return `Sign in as ${login.trim()} (${way === 'api' ? 'by API' : 'by screens'})`;
}
