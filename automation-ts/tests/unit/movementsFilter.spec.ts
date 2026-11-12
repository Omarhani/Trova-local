import { expect, test } from '@playwright/test';
import { filterToEmployee, MovementsSteps } from '../../src/web/pages/movementsFilter';
import { CaseTries } from '../../src/report/caseTries';

/**
 * Run 687 (owner + Lead, Java TransactionManagementPage.selectFirstEmployee): loaded (the loading layer gone) -> pick the
 * employee -> ONE "Show again" -> loaded -> only that employee's card. A list the app never finishes loading is a slow
 * answer: BLOCKED with expected / seen, and never a second try of the case.
 */

function steps(over: Partial<MovementsSteps> = {}) {
  const log: string[] = [];
  const s: MovementsSteps = {
    loaded: async () => { log.push('loaded'); return true; },
    pickEmployee: async () => { log.push('pick'); },
    showAgain: async () => { log.push('show again'); },
    onlyCardOf: async () => { log.push('cards'); return true; },
    ...over,
  };
  return { s, log };
}

test("Java's order: loaded, pick, ONE Show again, loaded, then the cards", async () => {
  const { s, log } = steps();
  await filterToEmployee(s, 'Omar X');
  expect(log).toEqual(['loaded', 'pick', 'show again', 'loaded', 'cards']);
});

test('still loading after Show again: BLOCKED with expected / seen - never tried again, never a second click', async () => {
  let n = 0;
  const { s, log } = steps({ loaded: async () => { log.push('loaded'); return ++n === 1; } });
  const err = await filterToEmployee(s, 'Omar X').catch((e: Error) => e);
  expect(err).toMatchObject({ name: 'SlowAnswer' });
  expect(String((err as Error).message)).toMatch(/expected.*loads.*seen.*still loading/i);
  expect(log.filter((l) => l === 'show again')).toHaveLength(1);
  const d = new Map<string, boolean>();
  const out = new CaseTries({ allow: (id) => { d.set(id, true); }, keep: (id) => { d.set(id, false); }, allowed: (id) => d.get(id) === true })
    .ends('c5', { status: 'failed', errors: [`${(err as Error).name}: ${(err as Error).message}`], annotations: [], retry: 0, retries: 1 });
  expect(out.end?.status).toBe('blocked');
  expect(out.note).toBeUndefined(); // no whole-case retry for a slow answer
});

test("loaded but other employees' cards stay: a wrong list is FAILED with the plain words", async () => {
  const { s } = steps({ onlyCardOf: async () => false });
  await expect(filterToEmployee(s, 'Omar X')).rejects.toThrow("did not show only Omar X's card within 20 s");
});
