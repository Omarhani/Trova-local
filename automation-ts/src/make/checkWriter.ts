import { ApiAction, MadeStep } from './madeRun';
import { plainName, quote } from './names';
import { ValueCode } from './valueCode';

/** one check line of the test and the same line in its trap twin (its expected value made wrong) */
export interface Check {
  fn: 'checkTrue' | 'checkContains' | 'checkEquals';
  line: string;
  trap: string;
}

const TRAP = ' (Trova trap)';

/** an expected value made surely wrong: a number one off, a text with words it never holds */
export function trapValue(expr: string): string {
  if (/^-?\d+$/.test(expr)) return String(Number(expr) + 1);
  if (/^'(?:[^'\\]|\\.)*'$/.test(expr)) return `${expr.slice(0, -1)}${TRAP}'`;
  return `${expr} + '${TRAP}'`;
}

function what(step: MadeStep): string {
  return `Step ${step.step} · ${(step.expected || step.text).trim()}`;
}

/** a label for one of several expected texts: the value's name, or the text itself */
function label(text: string): string {
  const one = /^\{([^{}]+)}$/.exec(text.trim());
  return one ? plainName(one[1]) : `"${text.trim()}"`;
}

function check(fn: Check['fn'], name: string, actual: string, expected: string, indent: string): Check {
  const head = `${indent}${fn}(${quote(name)}, ${actual}, `;
  return { fn, line: `${head}${expected});`, trap: `${head}${trapValue(expected)});` };
}

/** each text of the expected result the AI saw, checked on the page or screen the step ended on */
export function sawChecks(step: MadeStep, screen: string, values: ValueCode, indent = '  '): Check[] {
  const saw = (step.saw ?? []).filter((t) => t.trim());
  if (!step.expected?.trim()) return [];
  return saw.map((t) => {
    const name = saw.length > 1 ? `${what(step)} · ${label(t)}` : what(step);
    const head = `${indent}checkTrue(${quote(name)}, await ${screen}.shows(`;
    const expected = values.text(t);
    return { fn: 'checkTrue', line: `${head}${expected}));`, trap: `${head}${trapValue(expected)}));` };
  });
}

/** the app's answer checked as the AI checked it: its code, then the words it must hold */
export function answerChecks(step: MadeStep, a: ApiAction, answer: string, values: ValueCode, indent = '  '): Check[] {
  const out: Check[] = [];
  if (a.status !== undefined) out.push(check('checkEquals', `${what(step)} · answer code`, `${answer}.status`, String(a.status), indent));
  const says = (a.says ?? []).filter((t) => t.trim());
  for (const t of says) {
    const name = says.length > 1 ? `${what(step)} · ${label(t)}` : what(step);
    out.push(check('checkContains', name, `${answer}.text`, values.text(t), indent));
  }
  return out;
}

/** a set-up or clean-up call's answer code checked, so a failed one says so at once */
export function callCodeCheck(name: string, a: ApiAction, answer: string, indent = '  '): Check[] {
  return a.status === undefined ? [] : [check('checkEquals', `${name} · answer code`, `${answer}.status`, String(a.status), indent)];
}
