import { CallFacts } from '../report/networkEvents';
import { AppLine } from './logcatLine';
import { CallLogReader } from './callLogReader';

type Kind = 'request' | 'response' | 'error';

interface Block {
  kind: Kind;
  at: number;
  uri: string;
  method: string;
  status: number;
  error: string;
  /** the lines of the part being read: the request's data or the answer's text; null = not reading a body */
  body: string[] | null;
  kept: string[];
}

interface Sent {
  uri: string;
  method: string;
  at: number;
  data?: string;
}

const START: Array<[RegExp, Kind]> = [[/^\*\*\* Request \*\*\*/, 'request'], [/^\*\*\* Response \*\*\*/, 'response'], [/^\*\*\* Dio(Exception|Error) \*\*\*/, 'error']];
const FIELD = /^(uri|method|statusCode): (.*)$/;

/**
 * Flutter apps on Dio with its LogInterceptor on: "*** Request ***" (uri, method, headers, data), later "*** Response ***"
 * (uri, statusCode, Response Text) or "*** DioException ***" (uri, the error), each block ending with a blank line.
 * Answers can come back in any order, so an answer is matched to the oldest request sent to the same address. Headers
 * are never kept.
 */
export class DioLog implements CallLogReader {
  private block: Block | null = null;
  private readonly sent: Sent[] = [];

  read(line: AppLine): CallFacts[] {
    const text = line.text;
    const start = START.find(([re]) => re.test(text));
    if (start) {
      const done = this.end();
      this.block = { kind: start[1], at: line.at, uri: '', method: '', status: 0, error: '', body: null, kept: [] };
      return done;
    }
    if (!this.block) return [];
    if (text.trim() === '') return this.end();
    this.take(this.block, text);
    return [];
  }

  flush(): CallFacts[] {
    const done = this.end();
    this.sent.length = 0;
    return done;
  }

  private take(b: Block, text: string): void {
    const field = FIELD.exec(text);
    if (field && b.body === null) {
      if (field[1] === 'uri') b.uri = field[2].trim();
      else if (field[1] === 'method') b.method = field[2].trim();
      else b.status = Number(field[2]) || 0;
      return;
    }
    if (/^(data|Response Text):\s*$/.test(text)) b.body = b.kept;
    else if (/^headers:\s*$/.test(text)) b.body = null;
    else if (b.body) b.body.push(text);
    else if (b.kind === 'error' && !b.error) b.error = text.trim();
  }

  private end(): CallFacts[] {
    const b = this.block;
    this.block = null;
    if (!b || !b.uri) return [];
    const body = b.kept.length ? b.kept.join('\n') : undefined;
    if (b.kind === 'request') {
      this.sent.push({ uri: b.uri, method: b.method, at: b.at, data: body });
      return [];
    }
    const i = this.sent.findIndex((s) => s.uri === b.uri);
    const req = i >= 0 ? this.sent.splice(i, 1)[0] : undefined;
    const status = b.status || Number(/status code of (\d{3})/.exec(b.error)?.[1] ?? 0);
    const sent = req?.at ?? b.at;
    return [{ method: req?.method ?? '', url: b.uri, sent, status, ms: b.at - sent, request: req?.data, response: body, error: b.kind === 'error' ? b.error : '' }];
  }
}
