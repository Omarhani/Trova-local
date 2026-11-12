import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Draft, CodeFile, DraftFile } from '../../../src/make/draft';
import { MadeRun } from '../../../src/make/madeRun';
import { makeAutomation } from '../../../src/make/makeAutomation';

/**
 * Make automation (round 2): small recorded AI runs (no real secrets) and the project's own page, screen and API classes,
 * read from disk as Trova reads them on the tester's computer.
 */
export const ROOT = path.resolve(__dirname, '..', '..', '..');
const POM_FOLDERS = ['src/web/pages', 'src/phone/screens', 'src/api/services', 'src/api/flows'];

/** a recorded AI run of one passed case (tests/unit/make/runs/<name>.json), a fresh copy each time */
export function recorded(name: string): MadeRun {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'runs', `${name}.json`), 'utf8')) as MadeRun;
}

/** the project's page, screen and API classes as they are now (paths from automation-ts, with /) */
export function projectCode(): CodeFile[] {
  const out: CodeFile[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (rel.endsWith('.ts')) out.push({ path: rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8') });
    }
  };
  POM_FOLDERS.forEach(walk);
  return out;
}

/** the draft Trova makes from one recorded run over the project's code */
export function made(name: string, code: CodeFile[] = projectCode()): Draft {
  return makeAutomation(recorded(name), code);
}

/** the draft holds a test (nothing vacuous passes on an empty draft) */
export function expectMade(d: Draft): void {
  expect(d.refused).toBeUndefined();
  expect(d.method).toMatch(/^test[A-Z]\w+$/);
  expect(d.spec.text).toContain(`test('${d.method}'`);
}

/** every text the draft would write: classes, the test, its trap and the suite blocks */
export function everyText(d: Draft): string {
  const files: DraftFile[] = [...d.files, d.spec, d.trap].filter(Boolean);
  return [...files.map((f) => `${f.path}\n${f.text}`), d.suiteBlocks, d.trapBlocks, d.refused ?? ''].join('\n');
}

export function fileAt(d: Draft, p: string): DraftFile | undefined {
  return d.files.find((f) => f.path === p);
}

/** what a test must never hold itself - it calls page, screen and API methods only */
const RAW: [RegExp, string][] = [
  [/\b(?:Appium)?By\.\w+\(/, 'a locator'],
  [/xpath|css=|['"`]\/\/|resource-id|content-desc/i, 'a locator'],
  [/\bpage\.(?:locator|goto|click|fill|type|getBy\w+|\$\$?|evaluate)\(/, 'a raw page call'],
  [/\.(?:click|fill|tap|press|setValue|addValue)\(/, 'a raw click or typing'],
  [/\bphone\.(?:\$\$?|execute|action|touchAction)\(/, 'a raw phone call'],
  [/\bfetch\(|\bsend\(|(?<!credentials)\.(?:get|post|put|patch|call)\(/, 'a raw call to the app'],
];

/** the raw things found in a test text (empty = page / screen / API methods only) */
export function rawIn(spec: string): string[] {
  return RAW.filter(([re]) => re.test(spec)).map(([re, what]) => `${what}: ${spec.match(re)?.[0]}`);
}

/** the methods of a class text longer than limit lines: "name lines" */
export function methodsOver(text: string, limit: number): string[] {
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  let start = -1;
  let name = '';
  lines.forEach((l, i) => {
    const m = /^ {2}(?:(?:private|protected|public|static|async|readonly)\s+)*(\w+)\s*\(.*\)\s*(?::\s*[^=]+)?\{\s*$/.exec(l);
    if (start < 0 && m) { start = i; name = m[1]; }
    if (start >= 0 && /^ {2}}\s*$/.test(l)) {
      if (i - start + 1 > limit) out.push(`${name} ${i - start + 1}`);
      start = -1;
    }
  });
  return out;
}

export function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

/** technical words a tester must never read in a reason Trova gives */
export const TECH = /\b(?:tsc|typescript|locator|xpath|css|selector|method|class|function|import|spec|null|undefined|exception|stack|json|regex|playwright|appium|webdriver|endpoint|http)\b/i;
