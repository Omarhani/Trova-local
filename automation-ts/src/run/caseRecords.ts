import { test } from '@playwright/test';
import { blockedSkip } from '../report/blockedSkip';
import { MissingData } from '../report/failureKind';
import { RunRecords, runRecords } from './runRecords';

const PREFIX = 'caseRecord|';

let handed = 0;

/** how many records this process handed to the cases so far - a set-up's proof of what it made (Round 2 review) */
export function recordsHanded(): number {
  return handed;
}
const ALL = '*';

/** "Case 12 - Rejecting with a reason" -> "Rejecting with a reason"; undefined when nothing is left */
export function titleOf(block: string | undefined): string | undefined {
  if (block === undefined) return undefined;
  const t = block.replace(/^\s*case\s+[\d,\s]+\s*[-–:]\s*/i, '').trim();
  return t === '' ? undefined : t;
}

/** lower case letters and digits only, without a leading "test" - a method name and a case title meet */
export function normCase(text: string): string {
  const n = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return n.startsWith('test') && n.length > 4 ? n.slice(4) : n;
}

/** "A pending overtime request made by this run" and "pending overtime request" are one record */
export function normRecord(record: string): string {
  const r = record.toLowerCase().replace(/\s*(made|created)\s+(by|for|in)\s+this\s+run.*$/, '');
  return r.replace(/\b(a|an|the|one)\b/g, '').replace(/[^a-z0-9]/g, '');
}

function key(forTest: string, record: string): string {
  return PREFIX + (forTest === ALL ? ALL : normCase(forTest)) + '|' + normRecord(record);
}

/**
 * The ONE hand-over of a record from a set-up block (or an earlier case) to the test that uses it - the TS twin of
 * utils.CaseRecords. Kept in the run's records file (blocks may run in other workers); the run's feed shows only
 * "Pre-condition - <record> made", never the value.
 */
export class CaseRecords {
  constructor(private readonly store: RunRecords, private readonly say: (line: string) => void = console.log) {}

  /** the set-up made value for one test (its method name or case title); blank = "Not tested - needs <record>" */
  made(forTest: string, record: string, value: string): string {
    if (value.trim() === '') throw new MissingData(`Not tested - needs ${record.trim()}`);
    const k = key(forTest, record);
    for (const old of this.store.newestFirst(k)) this.store.forget(k, old);
    this.store.keep(k, value);
    handed++;
    this.say(`Pre-condition - ${record.trim()} made`);
    return value;
  }

  /** the set-up made value for every test that reads this record */
  madeForAll(record: string, value: string): string {
    return this.made(ALL, record, value);
  }

  /** the record made for the test (method name), else for its block's case title, else the shared one */
  forTest(method: string | undefined, block: string | undefined, record: string): string | undefined {
    for (const who of [method, titleOf(block), ALL]) {
      if (who === undefined) continue;
      const found = this.store.newestFirst(key(who, record))[0];
      if (found !== undefined) return found;
    }
    return this.onlyOneFor(method, titleOf(block));
  }

  /** the record for the test that runs now; the test is skipped "Not tested - needs <record> made by this run" when none */
  mine(record: string): string {
    const info = test.info();
    const found = this.forTest(info.title, info.project.name, record);
    if (found === undefined) blockedSkip(test.info(), 'data', `Not tested - needs ${record.trim()} made by this run`);
    return found as string;
  }

  /** one record for this test under another record name */
  private onlyOneFor(method: string | undefined, title: string | undefined): string | undefined {
    const mine = [method, title].filter((w): w is string => w !== undefined).map(normCase);
    const hits = this.store.kinds()
      .filter((k) => k.startsWith(PREFIX) && mine.includes(k.slice(PREFIX.length).split('|')[0]))
      .map((k) => this.store.newestFirst(k)[0]);
    return hits.length === 1 ? hits[0] : undefined;
  }
}

/** the run's case records (same file as the run's records) */
export const caseRecords = new CaseRecords(runRecords);
