import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { send } from '../../src/api/http';
import { kindOf } from '../../src/report/failureKind';

/**
 * Test 8094 run 688: the set-up's GetAccountIdByCode "did not answer (TypeError)" after 10.7 s - Node's fetch gives up
 * connecting after 10 s (UND_ERR_CONNECT_TIMEOUT); Java's client waits. A call now waits as long as its own limit, and a
 * call that cannot reach the server says why in words the run reads as a set-up problem (BLOCKED), never a wrong result.
 */

test('a slow server is waited for and its answer read', async () => {
  const server = http.createServer((_q, r) => setTimeout(() => r.end('{"Status":true}'), 200));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as AddressInfo).port;
  const answer = await send({ method: 'POST', url: `http://127.0.0.1:${port}/api/Account/GetAccountIdByCode`, headers: { 'Content-Type': 'application/json' }, body: '{}' });
  server.close();
  expect(answer).toEqual({ status: 200, text: '{"Status":true}' });
});

test('a server that cannot be reached is a set-up problem with its cause, never a bare TypeError', async () => {
  const err = await send({ method: 'GET', url: 'http://127.0.0.1:1/api/Account/GetAccountIdByCode', headers: {} }).catch((e: Error) => e);
  expect(String((err as Error).message)).toContain('ECONNREFUSED');
  expect(kindOf(`${(err as Error).name}: ${(err as Error).message}`).kind).toBe('setup');
});
