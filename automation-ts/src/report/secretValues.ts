import { randomBytes } from 'node:crypto';
import { emit } from './liveEvents';

/** a field whose value never shows: password (confirm / new), secret, token, code, OTP, PIN - English and Arabic */
const SECRET_FIELD = /pass(word|code)?|secret|token|\botp\b|otp|code|\bpin\b|كلمة\s*(المرور|السر)|رمز/i;
/** a password box found by its locator */
const PASSWORD_BOX = /type\s*=\s*["']?password/i;
export const MASK = '***';

/** where a secret goes: Trova's own channel (its reference and value), never a step, event, log or picture */
type Send = (ref: string, value: string) => void;

/** the secret field test: by its name or its password box */
export function secretField(element: string, selector = ''): boolean {
  return SECRET_FIELD.test(element) || PASSWORD_BOX.test(selector);
}

/** Trova's runner takes it (TROVA_SECRET_CHANNEL=1) and hands it to Trova sealed; else it is not sent at all */
const channel: Send = (ref, value) => {
  if (process.env.TROVA_SECRET_CHANNEL === '1') emit('secret', { ref, v: value });
};

/**
 * The run's secret values: each one masked as *** with its own reference (Trova keeps the value sealed, shown only on
 * request to a permitted user), and remembered so no later text (a check, a message) shows it.
 */
export class SecretValues {
  private readonly known = new Set<string>();

  constructor(private readonly send: Send = channel) {}

  /** the value kept by its new reference; gives the reference */
  keep(value: string): string {
    const ref = randomBytes(8).toString('hex');
    if (value.length > 1) this.known.add(value);
    this.send(ref, value);
    return ref;
  }

  /** the text with every secret of this run as *** (a one-letter secret never hides single letters) */
  hide(text: string): string {
    let out = text;
    for (const s of [...this.known].sort((a, b) => b.length - a.length)) out = out.split(s).join(MASK);
    return out;
  }
}

/** the run's one record of secrets (one per test process) */
export const secretValues = new SecretValues();
