import * as http from 'node:http';
import * as https from 'node:https';
import { SlowAnswer } from '../report/failureKind';
import { HttpAnswer, HttpRequest, HttpSend, json } from '../trova/http';

export { json };
export type { HttpAnswer, HttpRequest, HttpSend };

const LIMIT_MS = 60_000;

/**
 * The real call, 60 s at most for the whole of it - Test 8094 run 688: Node's fetch gave up CONNECTING after 10 s
 * ("did not answer (TypeError)", UND_ERR_CONNECT_TIMEOUT) where Java's client waits; this client has no separate connect
 * limit. A call that cannot reach the server says why (ECONNREFUSED, ETIMEDOUT ... = a set-up problem); one with no
 * answer in 60 s is a slow answer. Names its path, never its body.
 */
export const send: HttpSend = (request) => new Promise((resolve, reject) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(url, { method: request.method, headers: withLength(request.headers, request.body) }, (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
    res.on('error', (e) => reject(cannotReach(path, e)));
  });
  req.setTimeout(LIMIT_MS, () => req.destroy(new SlowAnswer(`The call ${path} - expected: an answer, seen: none within ${LIMIT_MS / 1000} s`)));
  req.on('error', (e) => reject(e instanceof SlowAnswer ? e : cannotReach(path, e)));
  if (request.body !== undefined) req.write(request.body);
  req.end();
});

function withLength(headers: Record<string, string>, body: string | undefined): Record<string, string | number> {
  return body === undefined ? headers : { ...headers, 'Content-Length': Buffer.byteLength(body) };
}

function cannotReach(path: string, e: Error & { code?: string }): Error {
  return new Error(`The call ${path} did not answer (${e.code ?? e.name}: ${e.message})`);
}
