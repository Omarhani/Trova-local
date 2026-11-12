import { kindOf, SignInProblem } from '../report/failureKind';
import { runSignInBook } from '../signin/runSignInBook';

/** where the run keeps a failed phone sign-in (the run's sign-in book; a "phone|" name never meets a web login) */
export interface PhoneSignInBook {
  refused(name: string): string | undefined;
  refuse(name: string, why: string): void;
}

/**
 * Item 9 (Test 8094 run 658: the run's one phone sign-in failed and each later case of the login waited ~100 s again):
 * ONE sign-in on the phone per login and run. The first failure ends its case with its reason and is booked; every
 * later case of that login is BLOCKED at once, with no new wait. A set-up problem (the phone session lost, the network)
 * is not booked - the case gets its one more try and signs in again.
 */
export async function phoneSignInOnce(userName: string, signIn: () => Promise<void>, book: PhoneSignInBook = runSignInBook): Promise<void> {
  const name = `phone|${userName.trim().toLowerCase()}`;
  const before = book.refused(name);
  if (before) throw new SignInProblem(`The phone sign-in of ${userName} failed earlier in this run (${before}) - this case could not run`);
  try {
    await signIn();
  } catch (e) {
    const said = e instanceof Error ? e.message : String(e);
    if (kindOf(`${e instanceof Error ? e.name : 'Error'}: ${said}`).kind !== 'setup') book.refuse(name, said.split(/\r?\n/)[0].slice(0, 200));
    throw e;
  }
}
