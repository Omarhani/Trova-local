import { callEvent, CallFacts, wantedCall } from '../report/networkEvents';
import { CallLogReader } from './callLogReader';
import { DioLog } from './dioLog';
import { AppLine, parseLogcat } from './logcatLine';
import { OkHttpLog } from './okHttpLog';
import { LogLine, problemOf } from './phoneProblems';

/** Network's one line when the app wrote none of its calls to the phone's log */
export const NO_APP_CALLS = "The app's own calls cannot be seen on this phone: the app does not write them to the phone's log. Only the test's own calls are shown here.";

export interface LogFeedSource {
  /** the log lines since the last read */
  readLog(): Promise<LogLine[]>;
  /** the app's processes running now */
  appPids(): Promise<number[]>;
  appPackage: string;
  emit(type: string, fields: Record<string, unknown>): void;
  /** the phone's time when the case started ("MM-DD HH:MM:SS"): earlier lines are left out; undefined = all */
  since?: Promise<string | undefined>;
  /** problems sent at most per case (default 200) */
  maxProblems?: number;
}

/**
 * The run screen's Problems and Network for a phone case, from the phone's own log read bit by bit during the case:
 * the app's warnings and errors (each once, at most maxProblems), and the app's own calls when it writes them to the
 * log (OkHttp, Dio). Nothing here fails the case: a log that cannot be read is simply not shown.
 */
export class PhoneLogFeed {
  private readonly pids = new Set<number>();
  private readonly sent = new Set<string>();
  private readonly readers: CallLogReader[] = [new OkHttpLog(), new DioLog()];
  private problems = 0;
  private leftOut = 0;
  private calls = 0;
  private finished = false;

  constructor(private readonly src: LogFeedSource) {}

  async drain(): Promise<void> {
    const log = await this.src.readLog().catch(() => [] as LogLine[]);
    (await this.src.appPids().catch(() => [] as number[])).forEach((p) => this.pids.add(p));
    const since = await (this.src.since ?? Promise.resolve(undefined)).catch(() => undefined);
    const lines = log.map((e) => parseLogcat(e.message, e.timestamp ?? Date.now()))
      .filter((l): l is AppLine => l !== undefined && inCase(l, since));
    lines.forEach((l) => this.learnPid(l));
    for (const line of lines) {
      this.problem(line);
      if (this.pids.has(line.pid)) this.sendCalls((r) => r.read(line));
    }
  }

  /** the last read, calls left open, how many problems were left out, and the note when the app wrote no calls - once */
  async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    await this.drain();
    this.sendCalls((r) => r.flush());
    if (this.leftOut > 0) this.src.emit('console', { level: 'warning', text: `${this.leftOut} more warnings and errors of the app were left out` });
    if (this.calls === 0) this.src.emit('note', { area: 'net', text: NO_APP_CALLS });
  }

  /** the app's process from the system's own words, for a process that already ended: "Start proc 4321:pkg/" or "Process: pkg, PID: 4321" */
  private learnPid(line: AppLine): void {
    const pkg = this.src.appPackage;
    if (!pkg) return;
    const m = new RegExp(`Start proc (\\d+):${escape(pkg)}[/:\\s]|Process: ${escape(pkg)}, PID: (\\d+)`).exec(line.text);
    if (m) this.pids.add(Number(m[1] ?? m[2]));
  }

  private problem(line: AppLine): void {
    const p = problemOf(line, this.pids, this.src.appPackage);
    if (!p || this.sent.has(p.text)) return;
    this.sent.add(p.text);
    if (this.problems >= (this.src.maxProblems ?? 200)) {
      this.leftOut++;
      return;
    }
    this.problems++;
    this.src.emit('console', { ...p });
  }

  private sendCalls(take: (r: CallLogReader) => CallFacts[]): void {
    for (const call of this.readers.flatMap(take)) {
      if (!wantedCall('xhr', call.url, call.method || 'GET')) continue;
      this.calls++;
      this.src.emit('call', callEvent(call));
    }
  }
}

/** written during the case: at or after its start (same second counts), compared as the phone writes its time */
function inCase(line: AppLine, since: string | undefined): boolean {
  return !since || !line.time || line.time.slice(0, since.length) >= since;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
