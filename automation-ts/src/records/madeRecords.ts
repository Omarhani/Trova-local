import { RunRecords, runRecords } from '../run/runRecords';

/** a kind of record by its store key and its plain name ("work plan") - all a maker needs to register what it made */
export interface RecordKey {
  readonly key: string;
  readonly noun: string;
}

const BY_TEST = '|deletedByTest';

/**
 * The ONE place every set-up maker registers what it made and every clean-up block drains (Omar 2026-11-13), for any
 * system: per kind, the ids (or unique names) this run made. Kept in the run's records file (blocks run in other
 * workers). A record a test deleted itself is moved aside, so the clean-up reads it back instead of claiming it gone.
 */
export class MadeRecords {
  constructor(private readonly store: RunRecords) {}

  /** the record is made (or may be, from now on): the clean-up deletes it */
  keep(kind: RecordKey, entry: string): void {
    if (!this.made(kind).includes(entry)) this.store.keep(kind.key, entry);
  }

  /** what the run made and has not cleaned up, newest first */
  made(kind: RecordKey): string[] {
    return this.store.newestFirst(kind.key);
  }

  /** a test deleted the record itself: the clean-up only reads it back */
  deletedByTest(kind: RecordKey, entry: string): void {
    this.store.forget(kind.key, entry);
    if (!this.deletedByTestOf(kind).includes(entry)) this.store.keep(kind.key + BY_TEST, entry);
  }

  deletedByTestOf(kind: RecordKey): string[] {
    return this.store.newestFirst(kind.key + BY_TEST);
  }

  /** the record is proved gone: off every list */
  forget(kind: RecordKey, entry: string): void {
    this.store.forget(kind.key, entry);
    this.store.forget(kind.key + BY_TEST, entry);
  }
}

/** the run's made records (same file as the run's records) */
export const madeRecords = new MadeRecords(runRecords);
