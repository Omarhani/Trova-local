import { IndexedClass } from './codeIndex';
import { MadeAction } from './madeRun';
import { lowerFirst, pascal } from './names';
import { PomProject } from './pomProject';

export type AreaName = 'web' | 'phone' | 'api';

/** where a kind of class lives and how its file is named */
export interface Area {
  suffix: string;
  file(name: string): string;
}

export const AREAS: Record<AreaName, Area> = {
  web: { suffix: 'Page', file: (n) => `src/web/pages/${n}.ts` },
  phone: { suffix: 'Screen', file: (n) => `src/phone/screens/${n}.ts` },
  api: { suffix: 'Api', file: (n) => `src/api/services/${lowerFirst(n)}.ts` },
};

/** a class is never grown past this many lines - a new part class takes what is new */
export const CLASS_LIMIT = 400;

function withSuffix(stem: string, suffix: string): string {
  return stem.endsWith(suffix) ? stem : `${stem}${suffix}`;
}

/** the class an action belongs to: the one Trova linked, else a name from the page, screen or call */
export function classOf(a: MadeAction): { area: AreaName; name: string } {
  if (a.on === 'web') return { area: 'web', name: a.pageClass || withSuffix(pascal(a.page) || 'Home', 'Page') };
  if (a.on === 'phone') return { area: 'phone', name: a.screenClass || withSuffix(pascal(a.screen) || 'App', 'Screen') };
  const first = a.path.split(/[/?]/).find((p) => p && !p.startsWith('{') && !/^api$/i.test(p)) ?? 'App';
  return { area: 'api', name: `${pascal(first) || 'App'}${a.side === 'phone' ? 'Phone' : ''}Api` };
}

function stemOf(name: string, suffix: string): string {
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/** the class and the part classes made when it was full (LeaveTypesPage, LeaveTypesPart2Page ...) */
export function family(project: PomProject, area: AreaName, name: string): IndexedClass[] {
  const { suffix } = AREAS[area];
  const part = new RegExp(`^${stemOf(name, suffix)}Part(\\d+)${suffix}$`);
  const parts = project.classes().filter((c) => part.test(c.name))
    .sort((a, b) => Number(part.exec(a.name)?.[1]) - Number(part.exec(b.name)?.[1]));
  const own = project.named(name);
  return own ? [own, ...parts] : parts;
}

/** the class that takes a new part of `adds` lines: one with room, else a new one (never a full class grown) */
export function placeFor(project: PomProject, area: AreaName, name: string, adds: number): { name: string; cls?: IndexedClass } {
  const roomy = family(project, area, name).find((c) => c.lines + adds <= CLASS_LIMIT);
  if (roomy) return { name: roomy.name, cls: roomy };
  if (!project.named(name) && !project.has(AREAS[area].file(name))) return { name };
  const { suffix } = AREAS[area];
  for (let n = 2; ; n++) {
    const next = `${stemOf(name, suffix)}Part${n}${suffix}`;
    if (!project.named(next) && !project.has(AREAS[area].file(next))) return { name: next };
  }
}
