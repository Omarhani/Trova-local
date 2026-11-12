/** the app's API for one kind of record: its id by the value the run kept, and its delete */
export interface RecordApi {
  idOf: (value: string) => Promise<string | number | undefined>;
  delete: (id: string) => Promise<unknown>;
}

/**
 * Not for clean-up blocks any more (Omar 2026-11-13): they use records/cleanUpByIds - delete by id, read back by id.
 * Hybrid clean-up: deletes by API only the records this run made (the values it kept), then checks by API that each is
 * gone; a gone one is forgotten. Gives back the ones still there - the clean-up step fails on them. Round 2: the
 * records are independent (each its own value), so they are cleaned at the same time; one whose call fails is given
 * back with its reason said, the others are still cleaned.
 */
export async function cleanUpMade(made: string[], api: RecordApi, forget: (value: string) => void,
                                  say: (line: string) => void = console.log): Promise<string[]> {
  const gone = await Promise.allSettled(made.map((value) => cleanOne(value, api)));
  const left: string[] = [];
  gone.forEach((g, i) => {
    if (g.status === 'fulfilled' && g.value) return forget(made[i]);
    if (g.status === 'rejected') say(`Clean-up of ${made[i]} could not finish: ${g.reason instanceof Error ? g.reason.message : String(g.reason)}`);
    left.push(made[i]);
  });
  return left;
}

/** true when the record is gone after its delete */
async function cleanOne(value: string, api: RecordApi): Promise<boolean> {
  const id = await api.idOf(value);
  if (id !== undefined) await api.delete(String(id));
  return (await api.idOf(value)) === undefined;
}
