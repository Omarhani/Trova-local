import { AREAS } from './classPlacer';
import { Channel } from './kindOf';
import { MadeRun } from './madeRun';
import { quote } from './names';
import { SpecUses, WrittenTest } from './testWriter';

const UP = '../../../';
const FROM: Record<string, string> = {
  param: 'src/run/blockParams', runLogin: 'src/run/credentials', credentials: 'src/run/credentials',
  runRecords: 'src/run/runRecords', answerValue: 'src/api/answerValue', AppApi: 'src/api/appApi',
  openSignedIn: 'src/phone/signedInPhone',
};
const BASE: Record<Channel, [string, string]> = {
  web: ['webTest as test', 'src/web/webTest'],
  phone: ['phoneTest as test', 'src/phone/phoneTest'],
  api: ['test', '@playwright/test'],
};

/** the imports of the spec: its test base, the run's helpers, the checks it makes and the classes it calls */
function imports(channel: Channel, uses: SpecUses): string[] {
  const by = new Map<string, Set<string>>();
  const add = (from: string, name: string): void => { by.set(from, (by.get(from) ?? new Set()).add(name)); };
  add(BASE[channel][1], BASE[channel][0]);
  uses.run.forEach((name) => add(FROM[name], name));
  uses.checks.forEach((fn) => add('src/report/checks', fn));
  uses.classes.forEach((area, name) => add(AREAS[area].file(name).replace(/\.ts$/, ''), name));
  return [...by].sort(([a], [b]) => (a.startsWith('@') ? -1 : b.startsWith('@') ? 1 : a.localeCompare(b)))
    .map(([from, names]) => `import { ${[...names].sort().join(', ')} } from '${from.startsWith('@') ? from : UP + from}';`);
}

function testText(t: WrittenTest): string {
  const fixture = t.fixture === 'page' ? '{ page }' : t.fixture === 'phone' ? '{ phone }' : '';
  return [`test(${quote(t.name)}, async (${fixture}) => {`, ...t.lines, '});'].join('\n');
}

/** the test file: imports, what it is with its business cycle, the case's test, then its clean-up test */
export function specText(channel: Channel, run: MadeRun, tests: WrittenTest[], uses: SpecUses, picture: string[] = []): string {
  const about = `Case ${run.caseId} - ${run.title}`.replace(/\*\//g, '* /').replace(/\s+/g, ' ');
  const first = `${about}: made by Trova from the passed AI run ${run.runId} - each step calls the project's own page, screen and API classes.`;
  const header = picture.length ? ['/**', ` * ${first}`, ' *', ...picture.map((l) => ` * ${l}`), ' */'].join('\n') : `/** ${first} */`;
  return [...imports(channel, uses), '', header, '', tests.map(testText).join('\n\n'), ''].join('\n');
}
