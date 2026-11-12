import { checkLines, Lines, statusAndWords } from './lines';
import { madeRecords, MadeRecords } from './madeRecords';
import { Made, RecordKind } from './recordKind';

export type { Lines } from './lines';

/**
 * Rule 2 (Omar 2026-11-13, run 1033): the clean-up deletes exactly the records this run made, by id. Each delete must
 * be answered ok AND a follow-up read must prove the record gone - one line each ("Deleted work plan id 41"). Nothing
 * made = one line "Nothing to delete - this run made no work plan". A list alone never counts, a failed delete never
 * passes. Every record is tried; the failures are given back (cleanUpRun fails the block on them).
 */
export async function cleanUpKind(kind: RecordKind, records: MadeRecords = madeRecords, lines: Lines = checkLines): Promise<string[]> {
  const made = records.made(kind);
  const byTest = records.deletedByTestOf(kind);
  if (made.length === 0 && byTest.length === 0) {
    lines.pass(`Nothing to delete - this run made no ${kind.noun}`);
    return [];
  }
  const failures: string[] = [];
  for (const entry of byTest) failures.push(...await guarded(kind, entry, lines, () => readBack(kind, entry, records, lines)));
  for (const entry of made) failures.push(...await guarded(kind, entry, lines, () => cleanOne(kind, entry, records, lines)));
  return failures;
}

/** every kind cleaned; the block FAILS once at the end with every record that is not proved gone */
export async function cleanUpRun(kinds: RecordKind[], records: MadeRecords = madeRecords, lines: Lines = checkLines): Promise<void> {
  const failures: string[] = [];
  for (const kind of kinds) failures.push(...await cleanUpKind(kind, records, lines));
  if (failures.length > 0) throw new Error(failures.join('\n'));
}

/** "work plan id 41" */
function shown(kind: RecordKind, m: Made): string {
  return `${m.noun ?? kind.noun} id ${m.id}`;
}

async function idOf(kind: RecordKind, entry: string): Promise<Made | undefined> {
  return kind.idOf ? kind.idOf(entry) : { entry, id: entry };
}

/** deletes one record by its id and reads it back; its failure line, or none */
async function cleanOne(kind: RecordKind, entry: string, records: MadeRecords, lines: Lines): Promise<string[]> {
  const m = await idOf(kind, entry);
  if (m === undefined) { // kept by its name before Save (the app may never have made it), or already gone
    records.forget(kind, entry);
    lines.pass(`Nothing to delete - this run's ${kind.noun} "${entry}" is not there (read back: not found)`);
    return [];
  }
  const kept = await kind.keptBecause?.(m);
  if (kept) {
    records.forget(kind, entry);
    lines.pass(`Not deleted: ${shown(kind, m)} - ${kept}`);
    return [];
  }
  const answer = await kind.delete(m);
  const verb = kind.done ?? 'Deleted';
  if (!answer.ok) return said(lines, `Expected: ${shown(kind, m)} ${verb.toLowerCase()} / Actual: ${statusAndWords(answer.status, answer.message)}`);
  const after = verb === 'Deleted' ? 'the delete' : `it was ${verb.toLowerCase()}`;
  if (await kind.isThere(m)) return said(lines, `Expected: ${shown(kind, m)} is gone / Actual: it is still there after ${after}`);
  records.forget(kind, entry);
  lines.pass(`${verb} ${shown(kind, m)}`);
  return [];
}

/** a record a test deleted itself: proved gone by a read, else deleted now like any other */
async function readBack(kind: RecordKind, entry: string, records: MadeRecords, lines: Lines): Promise<string[]> {
  const m = await idOf(kind, entry);
  if (m !== undefined && await kind.isThere(m)) return cleanOne(kind, entry, records, lines);
  records.forget(kind, entry);
  lines.pass(`Nothing to delete - the test already deleted ${m ? shown(kind, m) : `${kind.noun} "${entry}"`} (read back: gone)`);
  return [];
}

/** a call that broke (no answer, sign-in refused) fails that record with its words - the others are still cleaned */
async function guarded(kind: RecordKind, entry: string, lines: Lines, run: () => Promise<string[]>): Promise<string[]> {
  try {
    return await run();
  } catch (e) {
    return said(lines, `Expected: this run's ${kind.noun} "${entry}" deleted / Actual: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function said(lines: Lines, line: string): string[] {
  lines.fail(line);
  return [line];
}
