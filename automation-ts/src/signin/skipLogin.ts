/** the app refused this login's sign-in earlier in the run: every later case of it is skipped with that reason (Java: SKIPPED) */
export class SkipLogin extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipLogin';
  }
}
