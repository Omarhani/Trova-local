import { expect, test } from '@playwright/test';
import { cleanUpMade } from '../../src/run/cleanUpMade';

function fakeApi(records: Map<string, string>, keeps = new Set<string>()) {
  const deleted: string[] = [];
  return {
    deleted,
    idOf: async (v: string) => records.get(v),
    delete: async (id: string) => {
      deleted.push(id);
      for (const [k, x] of records) if (x === id && !keeps.has(k)) records.delete(k);
    },
  };
}

test('deletes only what this run made, checks each is gone, and forgets it', async () => {
  const records = new Map([['TC1', '1'], ['TC2', '2'], ['OTHER', '9']]);
  const api = fakeApi(records);
  const forgot: string[] = [];
  const left = await cleanUpMade(['TC2', 'TC1'], api, (v) => forgot.push(v));
  expect(left).toEqual([]);
  expect(api.deleted).toEqual(['2', '1']);
  expect(records.has('OTHER')).toBe(true);
  expect(forgot).toEqual(['TC2', 'TC1']);
});

test('a record still there after its delete is given back (the clean-up step fails), the others still deleted', async () => {
  const records = new Map([['TC1', '1'], ['TC2', '2']]);
  const api = fakeApi(records, new Set(['TC1']));
  const forgot: string[] = [];
  const left = await cleanUpMade(['TC1', 'TC2'], api, (v) => forgot.push(v));
  expect(left).toEqual(['TC1']);
  expect(api.deleted).toEqual(['1', '2']);
  expect(forgot).toEqual(['TC2']);
});

test('a record already gone is not deleted again and counts as cleaned', async () => {
  const api = fakeApi(new Map());
  expect(await cleanUpMade(['TC1'], api, () => undefined)).toEqual([]);
  expect(api.deleted).toEqual([]);
});

test('Round 2: the run\'s independent records are cleaned at the same time, each its own, in the order they were made', async () => {
  const records = new Map([['A', '1'], ['B', '2'], ['C', '3'], ['D', '4']]);
  const slow = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const api = {
    idOf: async (v: string) => { await slow(60); return records.get(v); },
    delete: async (id: string) => { await slow(60); for (const [k, x] of records) if (x === id) records.delete(k); },
  };
  const started = Date.now();
  const left = await cleanUpMade(['A', 'B', 'C', 'D'], api, () => undefined);
  expect(left).toEqual([]);
  expect(Date.now() - started).toBeLessThan(500); // one after another: 4 x 180 ms
});

test('Round 2: one record whose delete call fails is given back with its reason; the others are still cleaned', async () => {
  const records = new Map([['A', '1'], ['B', '2']]);
  const said: string[] = [];
  const api = {
    idOf: async (v: string) => records.get(v),
    delete: async (id: string) => { if (id === '1') throw new Error('HTTP 500'); records.delete('B'); },
  };
  const left = await cleanUpMade(['A', 'B'], api, () => undefined, (l) => said.push(l));
  expect(left).toEqual(['A']);
  expect(records.has('B')).toBe(false);
  expect(said.join()).toContain('HTTP 500');
});
