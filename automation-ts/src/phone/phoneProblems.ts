import { maskLogText } from '../report/logMask';
import { AppLine } from './logcatLine';
import { isNoise } from './phoneLogNoise';

/** one line of the phone's own log as WebdriverIO gives it (getLogs('logcat')): the whole log line in message */
export interface LogLine {
  timestamp?: number;
  level: string;
  message: string;
}

export interface Problem {
  level: 'warning' | 'error';
  text: string;
}

const MAX = 1000;
const LEVEL: Record<string, Problem['level']> = { W: 'warning', E: 'error', F: 'error', A: 'error' };

/**
 * A line for the run screen's Problems: the app under test's own warnings and errors (its processes only), the app
 * stopping (FATAL EXCEPTION in its process) and not responding (the system's "ANR in <app>") in plain words. Other
 * apps, info / debug lines and the system's noise are left out; the text is masked and kept to one line of 1000.
 */
export function problemOf(line: AppLine, appPids: Set<number>, appPackage: string): Problem | undefined {
  if (appPackage && line.text.includes(`ANR in ${appPackage}`)) return said('error', `The app did not respond: ${line.text.trim()}`);
  if (!appPids.has(line.pid)) return undefined;
  const level = LEVEL[line.level];
  if (!level) return undefined;
  if (/FATAL EXCEPTION/.test(line.text)) return said('error', `The app stopped: ${line.text.trim()}`);
  if (isNoise(line.tag, line.text)) return undefined;
  return said(level, `${line.tag}: ${line.text.trim()}`);
}

function said(level: Problem['level'], text: string): Problem {
  const one = maskLogText(text).replace(/[\r\n]+/g, ' ');
  return { level, text: one.length <= MAX ? one : `${one.slice(0, MAX)}...` };
}
