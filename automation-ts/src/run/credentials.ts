import { asObject, asText, byName, JsonObject, section } from './runDataFile';
import { loginField } from '../trova/recipeValues';

/**
 * The logins saved in Trova (Test Data -> Credentials), by the name the tester gave them - the TS twin of
 * utils.Credentials. Never log or report a value read here.
 */
export class Credentials {
  constructor(private readonly read: () => JsonObject = () => section('logins')) {}

  /** all fields of a login, in their order */
  of(login: string): Record<string, string> {
    const found = byName(this.read(), login);
    if (found === undefined) {
      throw new Error(`No login "${login}" (there are ${this.names().join(', ')}) - add it in Trova > Test Data > Credentials`);
    }
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(asObject(found))) fields[k] = asText(v);
    return fields;
  }

  /** one field of a login under any of its names ("Username|User name|Email"), case ignored */
  get(login: string, names: string): string {
    const value = Credentials.field(this.of(login), names);
    if (value === undefined) {
      throw new Error(`The login "${login}" has no field "${names.split('|')[0]}" - add it in Trova > Test Data > Credentials`);
    }
    return value;
  }

  names(): string[] {
    return Object.keys(this.read());
  }

  /** a field among several names ("Account code|Account|code"); undefined when it has none */
  static field(fields: Record<string, string>, names: string): string | undefined {
    return loginField(fields, names);
  }
}

/** the login a block runs as: TROVA_LOGIN for a local run, else the block's signedInAs, else the run's login */
export function runLogin(blockLogin?: string): string {
  const forced = process.env.TROVA_LOGIN?.trim();
  if (forced) return forced;
  if (blockLogin?.trim()) return blockLogin.trim();
  const run = asText(asObject(section('run')).login);
  if (run) return run;
  throw new Error('No login is set for this test - choose one in Trova > Tests ("Runs as") or in the Run dialog');
}

export const credentials = new Credentials();
