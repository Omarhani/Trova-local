import { checkLine } from '../report/checks';

/** where set-up and clean-up lines go: a passed line, a failed one (the run's check lines by default) */
export interface Lines {
  pass(line: string): void;
  fail(line: string): void;
}

/** the run page's check lines; a failed one is shown and does not stop the block (the caller decides) */
export const checkLines: Lines = {
  pass: (line) => checkLine(line, true, false),
  fail: (line) => checkLine(line, false, false),
};

/** "HTTP 400 - The plan has shifts": the status and the app's own words */
export function statusAndWords(status: number, message: string): string {
  const words = message.trim();
  return `HTTP ${status}${words ? ` - ${words}` : ''}`;
}
