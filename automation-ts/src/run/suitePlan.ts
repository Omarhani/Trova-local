/**
 * Trova's suite file (the same TestNG XML Trova keeps for every suite) read for a TS run: each <test> block becomes
 * one Playwright project, in order, with its parameters, groups and the TS tests it names. A TS test is named in the
 * XML as <class name="ts:<spec file>"> with <include name="<test name>"/> - the same shape as a Java class and method.
 */
export interface SuiteTest {
  spec: string;
  /** the test's name; "" = every test of the spec */
  method: string;
}

export interface SuiteBlock {
  name: string;
  params: Record<string, string>;
  groups: string[];
  tests: SuiteTest[];
}

export interface SuitePlan {
  name: string;
  params: Record<string, string>;
  blocks: SuiteBlock[];
}

const TS = 'ts:';

export function isTsSuite(xml: string): boolean {
  return /<class\s+name\s*=\s*"ts:/.test(xml);
}

export function parseSuite(xml: string): SuitePlan {
  const suite = /<suite\b([^>]*)>([\s\S]*)<\/suite>/.exec(xml);
  if (!suite) throw new Error('The suite file has no <suite> - open the suite in Trova and save it again');
  const body = suite[2];
  const blocksXml = [...body.matchAll(/<test\b([^>]*)>([\s\S]*?)<\/test>/g)];
  const outside = body.replace(/<test\b[\s\S]*?<\/test>/g, '');
  const params = parameters(outside);
  return {
    name: attr(suite[1], 'name'),
    params,
    blocks: blocksXml.map((m) => block(attr(m[1], 'name'), m[2], params)),
  };
}

function block(name: string, xml: string, suiteParams: Record<string, string>): SuiteBlock {
  const groupsXml = /<groups>([\s\S]*?)<\/groups>/.exec(xml)?.[1] ?? '';
  const groups = [...groupsXml.matchAll(/<include\b([^>]*)\/?>/g)].map((m) => attr(m[1], 'name'));
  return { name, params: { ...suiteParams, ...parameters(xml) }, groups, tests: tests(xml) };
}

function tests(xml: string): SuiteTest[] {
  const out: SuiteTest[] = [];
  for (const c of xml.matchAll(/<class\b([^>]*?)(?:\/>|>([\s\S]*?)<\/class>)/g)) {
    const name = attr(c[1], 'name');
    if (!name.startsWith(TS)) continue;
    const spec = name.slice(TS.length);
    const methods = [...(c[2] ?? '').matchAll(/<include\b([^>]*)\/?>/g)].map((m) => attr(m[1], 'name'));
    if (methods.length === 0) out.push({ spec, method: '' });
    for (const method of methods) out.push({ spec, method });
  }
  return out;
}

function parameters(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of xml.matchAll(/<parameter\b([^>]*)\/?>/g)) out[attr(p[1], 'name')] = attr(p[1], 'value');
  return out;
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return m ? unescape(m[1]) : '';
}

function unescape(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** a suite with a web spec or a Web block needs the run's browser */
export function needsWeb(plan: SuitePlan): boolean {
  return plan.blocks.some((b) => b.groups.some((g) => /^web/i.test(g))
    || b.tests.some((t) => t.spec.replace(/\\/g, '/').replace(/^\.?\//, '').startsWith('tests/web/')));
}
