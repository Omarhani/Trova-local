import { Row } from '../api/rows';

/** the plan list answer given to the page, the name the server has and the name the page is made to show */
export interface ChangedList {
  answer: unknown;
  real: string;
  shown: string;
}

/** the plan rows of the app's plan list answer: Data.List, or Data itself when it is the list */
function plansOf(answer: unknown): Row[] | undefined {
  const data = (answer as { Data?: unknown } | null | undefined)?.Data;
  if (Array.isArray(data)) return data as Row[];
  const list = (data as { List?: unknown } | null | undefined)?.List;
  return Array.isArray(list) ? (list as Row[]) : undefined;
}

/**
 * Self-healing trap (Omar 2026-11-11, case 6): a copy of the app's plan list answer with its first plan's name changed
 * (mark added), so the page shows a name the server does not have - the app wrong on purpose. The server's answer itself
 * is left as it was. undefined = no named plan to change.
 */
export function withFirstPlanRenamed(answer: unknown, mark: string): ChangedList | undefined {
  const real = String(plansOf(answer)?.[0]?.Name ?? '').trim();
  if (!real) return undefined;
  const copy = JSON.parse(JSON.stringify(answer)) as unknown;
  const first = plansOf(copy)![0];
  first.Name = `${real}${mark}`;
  return { answer: copy, real, shown: String(first.Name) };
}

/** the plan name the page's list shows for the changed plan: the real one, else the changed one, else said plainly */
export function planNameSeen(options: string[], real: string, shown: string): string {
  if (options.includes(real)) return real;
  return options.includes(shown) ? shown : 'no plan of that name in the list';
}
