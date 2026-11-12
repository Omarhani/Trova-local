import { randomUUID } from 'node:crypto';
import { testData } from '../run/testData';
import { HttpAnswer, HttpSend, json, send } from './http';
import { PHONE_HEADERS, phoneEnvelope } from './phoneEnvelope';
import { reportedSend } from './reportedSend';

/** a call under the app's root folder ("api/x"), the root added only when the address does not end with it */
export function underApiRoot(base: string, call: string): string {
  return base.replace(/\/+$/, '').toLowerCase().endsWith('/api') ? call : `api/${call}`;
}

/**
 * The phone app's API as a NEW employee calls it - before it has a login of its own (account code, sign-up, the
 * attendance method, its user info) - the TS twin of api.client.AvailoMobileApi. Used by set-up and by the API cases
 * that test the sign-up; never for the run's sign-in. Keeps the token the sign-up answered with, never prints it.
 */
export class PhoneGuestApi {
  private token = '';
  private userId = '';

  constructor(private readonly base: string = testData.mobileApiUrl(), private readonly sendCall: HttpSend = reportedSend(send)) {}

  /** the user id the sign-up or log-in answered with ('' before) */
  id(): string {
    return this.userId;
  }

  /** the data in the app's envelope; a body already in one (it has "Data") goes as it is - the same rule as AppApi's phone side */
  async post(endpoint: string, data: unknown): Promise<HttpAnswer> {
    const enveloped = data !== null && typeof data === 'object' && !Array.isArray(data) && 'Data' in data;
    return this.call('POST', endpoint, JSON.stringify(enveloped ? data : phoneEnvelope(this.userId, data, randomUUID())));
  }

  async get(endpoint: string): Promise<HttpAnswer> {
    return this.call('GET', endpoint);
  }

  /** an earlier block's sign-in of the same employee in this run: its token and user id for the calls that follow */
  useSignIn(token: string, userId: string): void {
    this.token = token;
    this.userId = userId;
  }

  /** the token the sign-up or log-in answered with ('' before) - kept only in the run's own sign-ins file, never printed */
  signInToken(): string {
    return this.token;
  }

  /** after a sign-up or log-in: the token and user id of the answer are used by the calls that follow */
  keepSignedIn(answer: HttpAnswer): void {
    const data = (json(answer) as { Data?: { AccessToken?: string; ID?: string } } | null)?.Data;
    this.token = String(data?.AccessToken ?? '');
    this.userId = String(data?.ID ?? '');
  }

  private async call(method: string, endpoint: string, body?: string): Promise<HttpAnswer> {
    const base = this.base.replace(/\/+$/, '');
    if (!base) throw new Error(`No phone API address for the ${testData.env()} environment: add it in Trova > Test Data > Environments`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=UTF-8', Accept: 'application/json', ...PHONE_HEADERS };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return this.sendCall({ method, url: `${base}/${underApiRoot(base, endpoint)}`, headers, body });
  }
}
