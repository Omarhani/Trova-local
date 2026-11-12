import { asObject, asText, runData } from '../run/runDataFile';
import { KnownCall } from '../trova/knownCall';

export * from '../trova/knownCall';

/** the run file's known calls (Trova hands them to the run), read once */
let all: KnownCall[] | undefined;

export function knownCalls(): KnownCall[] {
  if (all) return all;
  const list = runData().knownCalls;
  all = (Array.isArray(list) ? list : []).map((e) => {
    const o = asObject(e);
    return { side: (asText(o.side) || 'WEB').toUpperCase(), method: (asText(o.method) || 'GET').toUpperCase(),
             path: asText(o.path) || '/', body: asText(o.body) };
  });
  return all;
}
