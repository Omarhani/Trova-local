/** one line of the phone's log, read: which process and thread wrote it, its level (V D I W E F A), tag and text */
export interface AppLine {
  /** when the run got it (epoch ms) */
  at: number;
  /** the phone's own time of the line ("MM-DD HH:MM:SS.mmm"); none in the short form */
  time?: string;
  pid: number;
  tid: number;
  level: string;
  tag: string;
  text: string;
}

/** "11-10 12:34:56.789  4321  4350 E flutter : text" - the form Appium reads the log in (threadtime) */
const THREADTIME = /^(\d\d-\d\d\s+\d\d:\d\d:\d\d\.\d+)\s+(\d+)\s+(\d+)\s+([VDIWEFA])\s+(.*?)\s*: ?(.*)$/;
/** "E/tag( 4321): text" - the short form */
const BRIEF = /^([VDIWEFA])\/(.*?)\(\s*(\d+)\):\s?(.*)$/;

export function parseLogcat(message: string, at: number): AppLine | undefined {
  const m = THREADTIME.exec(message ?? '');
  if (m) return { at, time: m[1].replace(/\s+/, ' '), pid: Number(m[2]), tid: Number(m[3]), level: m[4], tag: m[5].trim(), text: m[6] };
  const b = BRIEF.exec(message ?? '');
  if (b) return { at, pid: Number(b[3]), tid: Number(b[3]), level: b[1], tag: b[2].trim(), text: b[4] };
  return undefined;
}
