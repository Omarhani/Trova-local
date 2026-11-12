import { ApiAction, MadeAction, MadeRun, MadeStep } from './madeRun';

/** a name that holds a secret: a password, a token, a key ... */
const SECRET_NAME = /pass(word|wd|code)|secret|token|api[-_ ]?key|otp|credential|authori[sz]ation|^pin$/i;
const PLACEHOLDER = /^\{([^{}]+)}$/;

export const SECRET_REFUSAL = 'A password or other secret in this case is typed as it is, not read from a saved login - '
  + 'save it under a login in Test Data and run the case again.';

export function isSecretName(name: string): boolean {
  return SECRET_NAME.test(name.trim());
}

/** the run as Trova may write it, or why it may not - in plain words and never with the secret itself */
export interface Guarded {
  run: MadeRun;
  refused?: string;
}

/**
 * Secrets never in code: the AI's sign-in steps are dropped (the run signs in once by itself), sign-in headers are left
 * out, a value typed from a saved login keeps only the login's name and field, a secret-named case value is never a
 * suite value - and a secret typed as it is refuses the draft.
 */
export function guardSecrets(run: MadeRun): Guarded {
  const secretNames = new Set(Object.keys(run.values).filter(isSecretName));
  const secretValues = new Set([...secretNames].map((n) => run.values[n]).filter((v) => v && v.trim()));
  const isSecretText = (v: unknown): boolean => typeof v === 'string'
    && (secretValues.has(v) || [...secretNames].some((n) => v.includes(`{${n}}`)));
  const values = Object.fromEntries(Object.entries(run.values).filter(([k]) => !secretNames.has(k)));
  const steps: MadeStep[] = run.steps.filter((s) => !s.actions.some((a) => a.on !== 'api' && a.action === 'login'))
    .map((s) => ({ ...s, actions: s.actions.map(cleanAction) }));
  const clean: MadeRun = { ...run, values, steps, setup: run.setup.map(cleanAction), cleanup: run.cleanup.map(cleanAction) };
  const all = [...steps.flatMap((s) => s.actions), ...clean.setup, ...clean.cleanup];
  const leaks = all.some((a) => (a.on === 'api' ? bodyLeaks(a.body, isSecretText) : typedLeaks(a, isSecretText)));
  return leaks ? { run: clean, refused: SECRET_REFUSAL } : { run: clean };
}

function cleanAction(a: MadeAction): MadeAction {
  if (a.on === 'api') {
    const call: ApiAction = { ...a };
    delete call.headers;
    return call;
  }
  if (!a.login) return a;
  const typed = { ...a, field: a.field || a.element || 'Password' };
  delete typed.value;
  return typed;
}

/** a value typed into a secret field, or a secret value typed, that is not read from a saved login */
function typedLeaks(a: MadeAction, isSecretText: (v: unknown) => boolean): boolean {
  if (a.on === 'api' || a.login || a.value === undefined) return false;
  if (isSecretText(a.value)) return true;
  const secretBox = /password|passcode|secret|token/i.test(`${a.element ?? ''} ${a.locator ?? ''}`);
  return secretBox && !isPlainPlaceholder(a.value);
}

function bodyLeaks(body: unknown, isSecretText: (v: unknown) => boolean, key = ''): boolean {
  if (Array.isArray(body)) return body.some((x) => bodyLeaks(x, isSecretText, key));
  if (body !== null && typeof body === 'object') {
    return Object.entries(body as Record<string, unknown>).some(([k, v]) => bodyLeaks(v, isSecretText, k));
  }
  if (isSecretText(body)) return true;
  return isSecretName(key) && body !== null && body !== undefined && body !== '' && !isPlainPlaceholder(body);
}

function isPlainPlaceholder(v: unknown): boolean {
  const m = typeof v === 'string' ? PLACEHOLDER.exec(v.trim()) : null;
  return m !== null && !isSecretName(m[1]);
}
