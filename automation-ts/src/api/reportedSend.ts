import { apiStep, makesRecord } from '../report/apiStep';
import { emit } from '../report/liveEvents';
import { callEvent } from '../report/networkEvents';
import { RecordNames, recordNames } from '../report/recordNames';
import { nextStep } from '../report/stepNumbers';
import { HttpSend } from '../trova/http';

type Say = (type: string, fields: Record<string, unknown>) => void;

/**
 * A call of the test's own API client (set-up, clean-up, a sign-in by API) shown in the run's Network like the Java API
 * client's (utils.ApiReport via LiveFeed.apiCall) - web, phone or hybrid: address and bodies masked, the headers (a
 * token among them) never shown; a call that does something is a step too, with the main values it sent (apiStep, a
 * secret as ***; a record by its plain name, never its id). The answer or the error reaches the test unchanged.
 */
export function reportedSend(send: HttpSend, say: Say = emit, names: RecordNames = recordNames): HttpSend {
  return async (request) => {
    const step = apiStep(request.method, request.url, request.body, undefined, names);
    if (step) say('step', { n: nextStep(), ...step });
    const sent = Date.now();
    const facts = { method: request.method, url: request.url, sent, request: request.body };
    try {
      const answer = await send(request);
      // run 642: the records it made or read, so a later step names them, never by id
      if (answer.status >= 200 && answer.status < 300) names.learn(request.body, answer.text, makesRecord(request.method, request.url));
      say('call', callEvent({ ...facts, status: answer.status, ms: Date.now() - sent, response: answer.text }, true));
      return answer;
    } catch (e) {
      say('call', callEvent({ ...facts, status: 0, ms: Date.now() - sent, error: e instanceof Error ? e.message : String(e) }, true));
      throw e;
    }
  };
}
