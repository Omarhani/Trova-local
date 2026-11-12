import { addPart, newClass } from './classEditor';
import { AREAS, AreaName, classOf, family, placeFor } from './classPlacer';
import { locatorKey, ROW } from './locatorKey';
import { ApiAction, PhoneAction, WebAction } from './madeRun';
import { callPart, openPart, Part, partLines, uiPart, UiAction } from './methodWriter';
import { PomProject } from './pomProject';
import { Found, reusedAction, reusedCall, reusedOpen } from './reuseFinder';

/** why a draft cannot be made, in plain words for the tester */
export class MakeRefusal extends Error {}

/** the class method a step calls */
export interface MethodRef {
  className: string;
  area: AreaName;
  method: string;
}

const UI: Record<string, UiAction> = { click: 'click', type: 'type', fill: 'type', enter: 'type', tap: 'tap' };

/**
 * Make automation: one action of the AI run -> the class method that does it. An existing method doing the same action
 * on the same element is reused; only a missing one is added, once, to the class with room for it.
 */
export class PartMaker {
  readonly reused: string[] = [];
  readonly added: string[] = [];

  constructor(private readonly project: PomProject) {}

  ui(a: WebAction | PhoneAction, step: number): MethodRef {
    const kind = UI[a.action.toLowerCase()];
    const action = !kind ? undefined : a.on === 'phone' ? (kind === 'click' ? 'tap' : kind) : (kind === 'tap' ? 'click' : kind);
    if (!action) throw new MakeRefusal(`Step ${step} has an action Trova cannot write yet (${a.action}) - this case is left for a person to automate.`);
    const key = a.locator ? locatorKey(a.locator) : undefined;
    if (!key) throw new MakeRefusal(`Step ${step}: the AI did not keep which element it used, so Trova cannot write it - run the case with the AI again.`);
    if (action === 'type' && key.includes(ROW)) throw new MakeRefusal(`Step ${step} types into one row of a list - Trova cannot write that yet, so this case is left for a person to automate.`);
    const { area, name } = classOf(a);
    const found = reusedAction(family(this.project, area, name), action, key);
    if (found) return this.reuse(area, found);
    const where = a.on === 'web' ? a.page : a.screen;
    return this.add(area, name, `The ${where} ${a.on === 'web' ? 'page' : 'screen'} - parts written by Trova from a passed AI run.`,
      (used) => uiPart(area, action, a.element ?? '', key, used));
  }

  open(a: WebAction): MethodRef {
    const { area, name } = classOf(a);
    const found = reusedOpen(family(this.project, area, name), a.page);
    if (found) return this.reuse(area, found);
    return this.add(area, name, `The ${a.page} page - parts written by Trova from a passed AI run.`,
      (used, base) => openPart(a.page, base === 'BasePage', used));
  }

  call(a: ApiAction): MethodRef {
    const { area, name } = classOf(a);
    const endpoint = `${a.method.toUpperCase()} ${a.path}`;
    const found = reusedCall(family(this.project, area, name), endpoint);
    if (found) return this.reuse(area, found);
    return this.add(area, name, `${name.replace(/Api$/, '')} by the app's API - Trova's known calls, written from a passed AI run.`,
      (used) => callPart(endpoint, used));
  }

  private reuse(area: AreaName, found: Found): MethodRef {
    const name = `${found.cls.name}.${found.method.name}`;
    if (!this.reused.includes(name) && !this.added.includes(name)) this.reused.push(name);
    return { className: found.cls.name, area, method: found.method.name };
  }

  private add(area: AreaName, name: string, about: string, make: (used: ReadonlySet<string>, base?: string) => Part): MethodRef {
    const place = placeFor(this.project, area, name, partLines(make(new Set())));
    const path = place.cls?.path ?? AREAS[area].file(place.name);
    const text = place.cls?.text ?? newClass(area, place.name, about);
    const base = place.cls ? place.cls.base : area === 'web' ? 'BasePage' : undefined;
    const part = make(place.cls?.members ?? new Set(), base);
    this.project.put(path, addPart(text, part));
    this.added.push(`${place.name}.${part.name}`);
    return { className: place.name, area, method: part.name };
  }
}
