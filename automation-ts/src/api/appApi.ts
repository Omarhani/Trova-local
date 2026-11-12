import { test } from '@playwright/test';
import { blockedSkip } from '../report/blockedSkip';
import { testData } from '../run/testData';
import { Json } from '../run/runDataFile';
import { keptValues, recipeFor, Side, signIn } from '../signin/signIns';
import { SkipLogin } from '../signin/skipLogin';
import { HttpAnswer, json, send } from './http';
import { fillKnownBody, findKnown, knownCalls, splitEndpoint } from './knownCall';
import { PhoneShape, shapeOf, wrap } from '../trova/phoneShape';
import { reportedSend } from './reportedSend';
import { sendSignedIn } from './signedSend';

/** headers a copied set must never carry - they emptied the body before (Availo "A non-empty request body is required") */
const TRANSPORT = new Set(['content-length', 'content-type', 'host', 'connection', 'accept-encoding', 'transfer-encoding', 'accept']);

/**
 * The app's API as one side of the app calls it, signed in as a Trova login - the TS twin of AppApi / AppMobileApi:
 * the web side sends the environment's API headers; the phone side its own headers and envelope.
 */
export class AppApi {
  private constructor(private readonly login: string, private readonly side: Side, private token: string,
                      private readonly kept: Record<string, string>, private readonly shape: PhoneShape) {}

  /** the run's one sign-in of login; the app refused it earlier in the run = this case is skipped with that reason */
  static async signedInAs(login: string, side: Side): Promise<AppApi> {
    const result = await signIn(login, side).catch((e: unknown) => {
      if (e instanceof SkipLogin) blockedSkip(test.info(), 'signin', e.message);
      throw e;
    });
    const kept = keptValues(result);
    const shape = side === 'phone' ? shapeOf(recipeFor(login, side), kept) : { headers: {} };
    return new AppApi(login, side, result.token, kept, shape);
  }

  /** a value the sign-in kept (USER_ID, ACCOUNT_ID); a plain error when it did not */
  value(key: string): string {
    const v = this.kept[key];
    if (!v) throw new Error(`The sign-in did not keep ${key} - add it to the sign-in recipe's browser list`);
    return v;
  }

  /** a call under the app's root folder ("api/x"), the root added only when the address does not end with it */
  underRoot(root: string, call: string): string {
    return this.base().toLowerCase().endsWith('/' + root.toLowerCase()) ? call : root + '/' + call;
  }

  async get(endpoint: string): Promise<HttpAnswer> {
    return this.send('GET', endpoint);
  }

  async post(endpoint: string, body: Json): Promise<HttpAnswer> {
    return this.send('POST', endpoint, JSON.stringify(this.side === 'phone' ? wrap(this.shape, body) : body));
  }

  /** an endpoint Trova knows ("POST /x") with its known body, filled with this sign-in's ids and the given values */
  async call(endpoint: string, values: Record<string, unknown>): Promise<HttpAnswer> {
    const [method, path] = splitEndpoint(endpoint);
    const known = findKnown(knownCalls(), this.side === 'phone' ? 'MOBILE' : 'WEB', method, path);
    const verb = method || known?.method || 'GET';
    if (!known && verb !== 'GET' && verb !== 'DELETE') {
      throw new Error(`Trova knows no body for ${verb} ${path} - it is not on the Endpoints page and no passed AI walk called it`);
    }
    const body = fillKnownBody(known, this.kept, values);
    const shaped = body !== undefined && this.side === 'phone' ? JSON.stringify(wrap(this.shape, JSON.parse(body) as Json)) : body;
    return this.send(verb, path, verb === 'GET' || verb === 'DELETE' ? undefined : shaped ?? '{}');
  }

  private base(): string {
    return (this.side === 'phone' ? testData.mobileApiUrl() : testData.apiUrl() || testData.webUrl()).replace(/\/+$/, '');
  }

  private async send(method: string, endpoint: string, body?: string): Promise<HttpAnswer> {
    const base = this.base();
    if (!base) throw new Error(`No API address for the ${testData.env()} environment: add it in Trova > Test Data > Environments`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=UTF-8', Accept: 'application/json' };
    const extra = this.side === 'phone' ? this.shape.headers : testData.apiHeadersForOneCall();
    for (const [k, v] of Object.entries(extra)) if (!TRANSPORT.has(k.trim().toLowerCase())) headers[k] = v;
    const url = `${base}/${endpoint.trim().replace(/^\/+/, '')}`;
    return sendSignedIn((token) => sentAndSaid({ method, url, headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers, body }),
      () => this.token, async () => { this.token = (await signIn(this.login, this.side, true)).token; });
  }
}

const sentAndSaid = reportedSend(send);

/** the answer's JSON when the call worked (HTTP 2xx), else a plain error with the endpoint and status */
export function ok(answer: HttpAnswer, endpoint: string): unknown {
  if (answer.status < 200 || answer.status >= 300) {
    const said = answer.text.length > 300 ? `${answer.text.slice(0, 300)}...` : answer.text;
    throw new Error(`${endpoint} answered HTTP ${answer.status}${said ? `: ${said}` : ''}`);
  }
  return json(answer);
}
