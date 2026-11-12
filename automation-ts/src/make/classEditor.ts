import { AreaName } from './classPlacer';
import { Import, Part } from './methodWriter';

const FIELD = /^\s+(?:(?:private|protected|public|readonly)\s+)*\w+\s*=\s*(?:Appium)?By\.\w+\(/;

function hasImport(lines: string[], name: string): boolean {
  return lines.some((l) => new RegExp(`^import \\{[^}]*\\b${name}\\b[^}]*\\}`).test(l));
}

function withImports(lines: string[], imports: Import[]): string[] {
  const missing = imports.filter((i, n) => !hasImport(lines, i.name) && imports.findIndex((x) => x.name === i.name) === n);
  if (!missing.length) return lines;
  const lastImport = lines.reduce((at, l, i) => (l.startsWith('import ') ? i : at), -1);
  const add = missing.map((i) => `import { ${i.name} } from '${i.from}';`);
  return [...lines.slice(0, lastImport + 1), ...add, ...lines.slice(lastImport + 1)];
}

/**
 * A part added to a class: its imports after the last import, its field after the last field, its row locator and its
 * method before the class's closing brace. Every line the class had is kept as it was.
 */
export function addPart(text: string, part: Part): string {
  let lines = withImports(text.split('\n'), part.imports);
  const classAt = lines.findIndex((l) => /^export class /.test(l));
  if (part.field) {
    const lastField = lines.reduce((at, l, i) => (i > classAt && FIELD.test(l) ? i : at), classAt);
    const apart = lastField === classAt && lines[classAt + 1]?.trim() && !/^}/.test(lines[classAt + 1]) ? [''] : [];
    lines = [...lines.slice(0, lastField + 1), part.field, ...apart, ...lines.slice(lastField + 1)];
  }
  const close = lines.findIndex((l, i) => i > classAt && /^}\s*$/.test(l));
  const body = [...(part.locator ? ['', ...part.locator] : []), '', ...part.method];
  const empty = lines.slice(classAt + 1, close).every((l) => !l.trim());
  return [...lines.slice(0, close), ...(empty ? body.slice(1) : body), ...lines.slice(close)].join('\n');
}

const START: Record<AreaName, (name: string, about: string) => string[]> = {
  web: (name, about) => ["import { BasePage } from './base/BasePage';", '', `/** ${about} */`, `export class ${name} extends BasePage {`, '}', ''],
  phone: (name, about) => ["import { PhoneActions } from '../phoneActions';", '', `/** ${about} */`,
    `export class ${name} extends PhoneActions {`, '}', ''],
  api: (name, about) => ["import { AppApi } from '../appApi';", '', `/** ${about} */`, `export class ${name} {`,
    '  constructor(private readonly api: AppApi) {}', '}', ''],
};

/** a new class in its own file, ready for its parts: a page, a screen, or an API class over the run's one sign-in */
export function newClass(area: AreaName, name: string, about: string): string {
  return START[area](name, about).join('\n');
}
