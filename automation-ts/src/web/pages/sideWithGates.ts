import { SideNames } from '../../api/services/transactionsApi';

/**
 * The movement form's gate list depends on the department chosen (run 913: the first department, a leftover of an
 * earlier run, had no gates). The departments are looked at in list order; the first with a gate is the one used.
 */
export async function firstSideWithGates(count: number, hasGates: (i: number) => Promise<boolean>): Promise<number | undefined> {
  for (let i = 0; i < count; i++) {
    if (await hasGates(i)) return i;
  }
  return undefined;
}

/** why the case is not tested when no department has a gate */
export function noSideWithGates(count: number): string {
  return `Not tested - needs a department with gates: none of the ${count} departments in the movement form has a gate`;
}

/** a text as an XPath literal (one with ' inside goes through concat) */
function literal(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  return `concat(${text.split("'").map((part) => `'${part}'`).join(`, "'", `)})`;
}

/** the drawer's option of the side found by API (case 529): any of its names, exactly */
export function sideOption(side: SideNames): string {
  return `//mat-option[${side.names.map((n) => `normalize-space(.)=${literal(n)}`).join(' or ')}]`;
}
