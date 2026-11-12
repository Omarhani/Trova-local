import { checkLines, Lines, statusAndWords } from './lines';
import { madeRecords, MadeRecords, RecordKey } from './madeRecords';
import type { CallResult } from './recordKind';

/** a create call's answer with the new record's id (or unique key) read from it */
export interface MadeAnswer extends CallResult {
  id?: string;
}

/**
 * Rule 1 (Omar 2026-11-13): a set-up by API is a checked step - the create call must succeed AND answer the record's
 * id. Its line shows the id ("Made employee id 512"); a refused call or a missing id FAILS the step with "Expected: the
 * employee is made / Actual: <status + app message>". The record is registered for the clean-up as soon as the app took
 * it: by its id, or by entry (its unique name) when given - so even an answer without an id is still cleaned up.
 */
export function madeChecked(kind: RecordKey, answer: MadeAnswer, entry?: string, records: MadeRecords = madeRecords,
                            lines: Lines = checkLines): string {
  const id = (answer.id ?? '').trim();
  if (answer.ok && (entry ?? id) !== '') records.keep(kind, entry ?? id);
  if (answer.ok && id !== '') {
    lines.pass(`Made ${kind.noun} id ${id}`);
    return id;
  }
  const actual = answer.ok ? `HTTP ${answer.status} - the answer has no id` : statusAndWords(answer.status, answer.message);
  const line = `Expected: the ${kind.noun} is made / Actual: ${actual}`;
  lines.fail(line);
  throw new Error(line);
}
