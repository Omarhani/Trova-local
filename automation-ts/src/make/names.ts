/**
 * Make automation: the names Trova gives what it writes - plain ASCII words from the case and the app, never a fia- name.
 */
const RESERVED = new Set(['page', 'phone', 'test', 'param', 'credentials', 'runLogin', 'runRecords', 'appApi', 'phoneApi',
  'class', 'new', 'default', 'delete', 'function', 'return', 'this', 'const', 'let', 'var', 'in', 'of', 'for', 'if', 'do']);

export function words(text: string): string[] {
  return text.match(/[A-Za-z0-9]+/g) ?? [];
}

/** "Admin adds a leave type" -> "AdminAddsALeaveType" */
export function pascal(text: string): string {
  return words(text).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

/** "My payslips" -> "myPayslips"; "" when the text has no plain letters */
export function camel(text: string): string {
  const p = pascal(text);
  if (!p) return '';
  const c = p[0].toLowerCase() + p.slice(1);
  return /^\d/.test(c) ? `v${c}` : c;
}

export function lowerFirst(name: string): string {
  return name ? name[0].toLowerCase() + name.slice(1) : name;
}

/** the local name a case value is read into ("leave_type_name" -> leaveTypeName), never a name the test already uses */
export function valueVar(name: string): string {
  const c = camel(name) || 'value';
  return RESERVED.has(c) ? `${c}Value` : c;
}

/** the test's name: test + the case title (testAdminAddsALeaveType) */
export function testName(title: string, caseId: number): string {
  return `test${pascal(title).slice(0, 80) || `Case${caseId}`}`;
}

/** the clean-up test of a made test (cleanUpAdminAddsALeaveType) */
export function cleanUpName(method: string): string {
  return `cleanUp${method.replace(/^test/, '')}`;
}

/** where the test and its trap go: tests/<web|mobile|api>/<name>/<name>.spec.ts and <name>Trap.spec.ts */
export function testPaths(area: 'web' | 'mobile' | 'api', method: string): { spec: string; trap: string } {
  const name = lowerFirst(method.replace(/^test/, ''));
  return { spec: `tests/${area}/${name}/${name}.spec.ts`, trap: `tests/${area}/${name}/${name}Trap.spec.ts` };
}

/** a TS text literal in single quotes */
export function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')}'`;
}

/** a words-only label of a value name ("leave_type_name" -> "leave type name") */
export function plainName(name: string): string {
  return words(name).join(' ').toLowerCase();
}
