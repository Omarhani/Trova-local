import { appAnswer } from '../api/appAnswer';
import type { HttpAnswer } from '../api/http';
import type { RecordKey } from './madeRecords';

/** what the app answered to a create or delete call: did it take it, its HTTP status and its own words */
export interface CallResult {
  ok: boolean;
  status: number;
  message: string;
}

/** one record the run made: what was kept (its id, or its unique name) and its id in the app now */
export interface Made {
  entry: string;
  id: string;
  /** a kind with two shapes says which one this is ("registration request"); else the kind's noun */
  noun?: string;
}

/**
 * One kind of record a run makes (employee, work plan, leave, overtime request ...) - the app-specific calls only: how
 * to delete one by its id and how to read it back. The generic clean-up (cleanUpByIds) does the rest for any system.
 */
export interface RecordKind extends RecordKey {
  /** the clean-up's word when the app has no delete (an invoice is cancelled); default "Deleted" */
  readonly done?: string;
  /** the record's id now, for an entry kept by its unique name; undefined = not there. Default: the entry is the id */
  idOf?(entry: string): Promise<Made | undefined>;
  delete(m: Made): Promise<CallResult>;
  /** the follow-up read by id: true while the record is still there */
  isThere(m: Made): Promise<boolean>;
  /** why the app keeps this record on purpose (a decided overtime request has no delete); undefined = delete it */
  keptBecause?(m: Made): Promise<string | undefined>;
}

/** the app's answer as a CallResult: HTTP 2xx and no false Result / Status flag, else its own words */
export function resultOf(answer: HttpAnswer): CallResult {
  const said = appAnswer(answer);
  return { ok: said.ok, status: answer.status, message: said.message };
}

/** a service call that throws on a refusal (ok() of appApi) as its CallResult; the status read from its words */
export async function settled(call: () => Promise<unknown>): Promise<CallResult> {
  try {
    await call();
    return { ok: true, status: 200, message: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: Number(/HTTP (\d{3})/.exec(message)?.[1] ?? 0), message };
  }
}

/** the value made once, on first use (a clean-up with nothing to delete never signs in) */
export function once<T>(make: () => Promise<T>): () => Promise<T> {
  let made: Promise<T> | undefined;
  return () => (made ??= make());
}
