import { CallFacts } from '../report/networkEvents';
import { AppLine } from './logcatLine';
import { CallLogReader } from './callLogReader';

const REQUEST = /^--> ([A-Z]+) (https?:\/\/\S+)/;
const REQUEST_END = /^--> END /;
const ANSWER = /^<-- (\d{3})\b.*?(https?:\/\/\S+)(?: \((\d+)ms)?/;
const FAILED = /^<-- HTTP FAILED: (.*)$/;
const ANSWER_END = /^<-- END HTTP/;

interface Open {
  facts: CallFacts;
  /** past the blank line between headers and body */
  inBody: boolean;
  part: 'request' | 'answer';
}

/**
 * Android apps on OkHttp with its logging on (HttpLoggingInterceptor): "--> POST url", headers, a blank line, the body,
 * "--> END POST", then "<-- 200 OK url (85ms)", headers, body, "<-- END HTTP" - all on the calling thread, so each thread
 * is followed on its own. Headers (a token among them) are never kept; only the bodies after the blank line.
 */
export class OkHttpLog implements CallLogReader {
  private readonly open = new Map<number, Open>();

  read(line: AppLine): CallFacts[] {
    const text = line.text;
    const request = REQUEST.exec(text);
    if (request) return this.start(line, request[1], request[2]);
    const call = this.open.get(line.tid);
    if (!call) return [];
    const failed = FAILED.exec(text);
    if (failed) return this.close(line.tid, { status: 0, ms: line.at - call.facts.sent, error: failed[1].trim() });
    const answer = ANSWER.exec(text);
    if (answer) {
      Object.assign(call.facts, { status: Number(answer[1]), ms: answer[3] ? Number(answer[3]) : line.at - call.facts.sent });
      Object.assign(call, { part: 'answer', inBody: false });
      return [];
    }
    if (ANSWER_END.test(text)) return this.close(line.tid, {});
    if (REQUEST_END.test(text)) return [];
    this.body(call, text);
    return [];
  }

  flush(): CallFacts[] {
    const done = [...this.open.values()].filter((c) => c.part === 'answer').map((c) => c.facts);
    this.open.clear();
    return done;
  }

  private start(line: AppLine, method: string, url: string): CallFacts[] {
    const left = this.open.get(line.tid);
    this.open.set(line.tid, { facts: { method, url, sent: line.at, status: 0, ms: 0, request: undefined, response: undefined, error: '' },
      inBody: false, part: 'request' });
    return left?.part === 'answer' ? [left.facts] : [];
  }

  private body(call: Open, text: string): void {
    if (!call.inBody) {
      call.inBody = text.trim() === '';
      return;
    }
    const key = call.part === 'request' ? 'request' : 'response';
    call.facts[key] = call.facts[key] === undefined ? text : `${call.facts[key]}\n${text}`;
  }

  private close(tid: number, last: Partial<CallFacts>): CallFacts[] {
    const call = this.open.get(tid);
    this.open.delete(tid);
    return call ? [{ ...call.facts, ...last }] : [];
  }
}
