import { HttpAnswer } from './http';

/**
 * A call with the run's sign-in (kept for every block of the run, as Java keeps one): when the app answers 401 - it
 * dropped that sign-in - Trova signs in anew once and sends the call again. 403 (no right) is the app's answer as it is.
 */
export async function sendSignedIn(send: (token: string) => Promise<HttpAnswer>, token: () => string,
                                   resign: () => Promise<void>): Promise<HttpAnswer> {
  const first = await send(token());
  if (first.status !== 401) return first;
  console.log('The app no longer took the run\'s sign-in (401) - signing in again and sending the call once more');
  await resign();
  return send(token());
}
