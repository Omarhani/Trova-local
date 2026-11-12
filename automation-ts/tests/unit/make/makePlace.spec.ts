import { expect, test } from '@playwright/test';
import { CodeFile } from '../../../src/make/draft';
import { expectMade, lineCount, made, methodsOver, projectCode } from './makeFixtures';

/**
 * Make automation - the project's structure rules hold for what Trova writes: each part in its own folder (web pages,
 * phone screens, API classes), one class per file named for its job, files ~400 lines at most (a full class is never
 * grown - a new class takes the new part), methods ~50 lines at most.
 */
const KINDS = ['webUi', 'phone', 'hybrid', 'api', 'reuse'];
const PLACE = /^src\/(web\/pages\/\w+Page|phone\/screens\/\w+Screen|api\/services\/\w+Api|api\/flows\/\w+)\.ts$/;

for (const kind of KINDS) {
  test(`${kind}: every class written is in its folder, one class per file, named for its job`, () => {
    const d = made(kind);
    expectMade(d);
    expect(d.files.length).toBeGreaterThan(0);
    for (const f of d.files) {
      expect(f.path).toMatch(PLACE);
      expect(f.path).not.toMatch(/fia/i);
      expect((f.text.match(/^export class /gm) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  test(`${kind}: no file over 400 lines and no method over 50 lines`, () => {
    const d = made(kind);
    expectMade(d);
    for (const f of [...d.files, d.spec, d.trap]) {
      expect(lineCount(f.text), f.path).toBeLessThanOrEqual(400);
      expect(methodsOver(f.text, 50), f.path).toEqual([]);
    }
  });

  test(`${kind}: no BOM in what Trova writes`, () => {
    const d = made(kind);
    expectMade(d);
    for (const f of [...d.files, d.spec, d.trap]) expect(f.text.charCodeAt(0), f.path).not.toBe(0xfeff);
  });
}

test('a page class already at its size limit is never grown - the new part goes into a new class of that page', () => {
  const full = fullClass('LeaveTypesPage', 396);
  const code: CodeFile[] = [...projectCode(), { path: 'src/web/pages/LeaveTypesPage.ts', text: full }];
  const d = made('webUi', code);
  expect(d.refused).toBeUndefined();
  expect(d.files.find((f) => f.path === 'src/web/pages/LeaveTypesPage.ts')).toBeUndefined();
  const added = d.files.filter((f) => f.isNew && f.path.startsWith('src/web/pages/'));
  expect(added).toHaveLength(1);
  expect(added[0].path).toMatch(/^src\/web\/pages\/LeaveTypes\w+Page\.ts$/);
  expect(d.spec.text).toMatch(/new LeaveTypes\w+Page\(page\)/);
});

/** a page class of the given size with nothing the run used */
function fullClass(name: string, lines: number): string {
  const head = ["import { Page } from '@playwright/test';", "import { By } from '../by';", "import { WebActions } from '../webActions';", '',
    `/** ${name} - a long page class */`, `export class ${name} extends WebActions {`];
  const body: string[] = [];
  for (let i = 0; head.length + body.length + 2 < lines; i++) {
    body.push(`  private readonly filler${i} = By.xpath("//div[@id='filler-${i}']");`);
  }
  return [...head, ...body, '  constructor(page: Page) { super(page); }', '}', ''].join('\n');
}
