import { randomUUID } from 'node:crypto';
import { asObject, asText, byName, JsonObject, section } from './runDataFile';

/** The phone app of the environment (Test Data -> Environments -> Mobile app). */
export interface MobileApp {
  appPackage: string;
  appActivity: string;
  appFile: string;
}

/**
 * The run's environment data from Trova (Test Data -> Environments) - the TS twin of utils.TestData: addresses, API
 * headers, the phone app. Trova is the only source; no data file in the code.
 */
export class TestData {
  constructor(private readonly read: () => JsonObject = () => section('testData'),
              private readonly envName: () => string = () => process.env.TROVA_ENV?.trim() || 'Test') {}

  env(): string {
    return this.envName();
  }

  webUrl(): string {
    return this.address('WEB_URL');
  }

  apiUrl(): string {
    return this.address('API_BASE_URI');
  }

  /** the API the phone app calls; empty = the API */
  mobileApiUrl(): string {
    return this.address('MOBILE_API_BASE_URI') || this.apiUrl();
  }

  apiHeaders(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(asObject(asObject(this.read().API).HEADERS))) out[k] = asText(v);
    return out;
  }

  /** the fixed headers plus a fresh value for each per-call one (time-like names: the time in ms, else a new id) */
  apiHeadersForOneCall(): Record<string, string> {
    const out = this.apiHeaders();
    const names = asObject(this.read().API).PER_REQUEST_HEADERS;
    for (const name of Array.isArray(names) ? names.map(asText) : []) {
      out[name] = /time|date/i.test(name) ? String(Date.now()) : randomUUID();
    }
    return out;
  }

  isProd(): boolean {
    return this.read().PROD === true;
  }

  mobile(): MobileApp {
    const m = asObject(this.read().MOBILE);
    return { appPackage: asText(m.APP_PACKAGE), appActivity: asText(m.APP_ACTIVITY), appFile: asText(m.APK_PATH) };
  }

  private address(key: string): string {
    return asText(asObject(byName(asObject(this.read().ENVIRONMENTS), this.env()))[key]);
  }
}

export const testData = new TestData();
