import { Bounds } from '../core/checkTap';
import { FieldState } from '../core/fieldKeys';
import { SetUpProblem } from '../report/failureKind';
import { elements } from './pageTree';

/** the package part of an Android resource id ("com.app:id/") */
const ID_PACKAGE = /^.*:id\//;

/** run 870: a step whose element this cannot read is our own step - Not checked, in plain words (never its XPath) */
const UNREADABLE = 'Not checked - our test step needs a look: it names its element in a way Trova cannot read on the phone screen';

/** one element of the screen as the phone's page tree gives it */
export interface ScreenNode {
  id: string;
  desc: string;
  text: string;
  cls: string;
  checkable: boolean;
  checked: boolean;
  bounds: Bounds;
  /** the tooltip: an arrow with no description has only this ("Next month") */
  tip: string;
  /** a password box: its text is never read */
  password: boolean;
}

/**
 * The phone screen read ONCE (one page tree, about 0.2 s - the AI-run tools' way) and asked in memory: is an element
 * there, where is its middle, which boxes are ticked (Test 8094 runs 587/588: every look was its own slow phone call).
 * A locator is read by the resource ids and descriptions it names; a locator this cannot read fails, never guessed.
 */
export class ScreenSnapshot {
  private constructor(readonly nodes: ScreenNode[]) {}

  static of(xml: string): ScreenSnapshot {
    const nodes: ScreenNode[] = [];
    for (const get of elements(xml)) {
      const b = (get('bounds').match(/-?\d+/g) ?? []).map(Number);
      nodes.push({ id: get('resource-id').replace(/^.*:id\//, ''), desc: get('content-desc'), text: get('text'), cls: get('class'),
                   checkable: get('checkable') === 'true', checked: get('checked') === 'true', tip: get('tooltip-text'), password: get('password') === 'true',
                   bounds: [b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0] });
    }
    return new ScreenSnapshot(nodes);
  }

  has(selector: string): boolean {
    return this.find(selector) !== undefined;
  }

  /** the element's middle (where a finger taps); undefined when it is not on the screen */
  middle(selector: string): [number, number] | undefined {
    const n = this.find(selector);
    return n ? [Math.round((n.bounds[0] + n.bounds[2]) / 2), Math.round((n.bounds[1] + n.bounds[3]) / 2)] : undefined;
  }

  /**
   * the element's box and the screen's size (phone pixels), sent with the step so the run page marks it like a web
   * step (Omar 2026-11-11); undefined when it is not on the screen
   */
  mark(selector: string): { b: Bounds; sw: number; sh: number } | undefined {
    const n = this.find(selector);
    if (!n) return undefined;
    const sw = Math.max(...this.nodes.map((x) => x.bounds[2])), sh = Math.max(...this.nodes.map((x) => x.bounds[3]));
    return { b: [...n.bounds] as Bounds, sw, sh };
  }

  /** the text box of a field (the element itself, or the text box inside it); undefined when it is not on the screen */
  field(selector: string): FieldState | undefined {
    const n = this.find(selector);
    if (!n) return undefined;
    const inside = (b: Bounds): boolean => b[0] >= n.bounds[0] && b[1] >= n.bounds[1] && b[2] <= n.bounds[2] && b[3] <= n.bounds[3];
    const box = /EditText/.test(n.cls) ? n : this.nodes.find((x) => /EditText/.test(x.cls) && inside(x.bounds));
    return box ? { text: box.text, password: box.password } : undefined;
  }

  /** the tickable boxes whose id starts with prefix, top to bottom */
  boxes(prefix: string): { id: string; checked: boolean; bounds: Bounds }[] {
    return this.nodes.filter((n) => n.checkable && n.id.startsWith(prefix))
      .sort((a, b) => a.bounds[1] - b.bounds[1]).map((n) => ({ id: n.id, checked: n.checked, bounds: n.bounds }));
  }

  private find(selector: string): ScreenNode | undefined {
    // run 870: an id may come with its package ("com.android.permissioncontroller:id/...") - the screen's ids do not
    const ids = [...selector.matchAll(/@resource-id\s*=\s*["']([^"']+)["']/g)].map((m) => m[1].replace(ID_PACKAGE, ''));
    const idParts = [...selector.matchAll(/contains\(@resource-id,\s*["']([^"']+)["']\)/g)].map((m) => m[1].replace(ID_PACKAGE, ''));
    const descs = [...selector.matchAll(/@content-desc\s*=\s*["']([^"']*)["']/g)].map((m) => m[1]);
    const contains = [...selector.matchAll(/contains\(@content-desc,\s*["']([^"']+)["']\)/g)].map((m) => m[1]);
    const starts = [...selector.matchAll(/starts-with\(@content-desc,\s*["']([^"']+)["']\)/g)].map((m) => m[1]);
    const tips = [...selector.matchAll(/@tooltip-text\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
    if (!ids.length && !idParts.length && !descs.length && !contains.length && !starts.length && !tips.length) throw new SetUpProblem(UNREADABLE);
    return this.nodes.find((n) => ids.includes(n.id) || idParts.some((p) => n.id.includes(p)) || descs.includes(n.desc)
      || contains.some((c) => n.desc.includes(c)) || starts.some((p) => n.desc.startsWith(p)) || tips.includes(n.tip));
  }
}

