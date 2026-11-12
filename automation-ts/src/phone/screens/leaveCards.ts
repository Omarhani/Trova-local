/** "Pending" in the app's two languages (the card's status line, the counter's name) */
export const PENDING_WORDS: readonly string[] = ['Pending', 'تحت الإجراء'];

/** one request card of My requests: "<id>\n<status>\n<type - duration>\n<from - to>\n<sent on>..." */
export interface LeaveCard {
  id: string;
  status: string;
  lines: string[];
}

const linesOf = (desc: string): string[] => desc.split('\n').map((l) => l.trim());

/** the request cards among the screen's descriptions (a counter "2\nPending" has 2 lines and is no card) */
export function cardsOf(descs: string[]): LeaveCard[] {
  return descs.map(linesOf)
    .filter((l) => l.length >= 3 && /^\d+$/.test(l[0]))
    .map((l) => ({ id: l[0], status: l[1], lines: l }));
}

export function isPending(card: LeaveCard): boolean {
  return PENDING_WORDS.includes(card.status);
}

/** the number on the Pending counter ("2\nPending"); undefined when the counter is not on the screen */
export function pendingCountOf(descs: string[]): number | undefined {
  for (const l of descs.map(linesOf)) {
    if (l.length !== 2) continue;
    // run 781: the new layout writes the word first ("Pending\n2"), the old one the number first ("2\nPending")
    const [n, word] = /^\d+$/.test(l[0]) ? [l[0], l[1]] : [l[1], l[0]];
    if (/^\d+$/.test(n) && PENDING_WORDS.includes(word)) return Number(n);
  }
  return undefined;
}

/** the success message's text: the app's snackbar says it twice ("a, a") */
export function toastText(desc: string): string {
  const t = desc.trim();
  const half = (t.length - 2) / 2;
  return Number.isInteger(half) && half > 0 && t.slice(0, half) === t.slice(half + 2) && t.slice(half, half + 2) === ', ' ? t.slice(0, half) : t;
}

/** every card on the screen is one of the employee's own requests (ids from its own list) - else the app is someone else's */
export function allListed(cards: LeaveCard[], ids: Array<string | number>): boolean {
  const own = new Set(ids.map(String));
  return cards.every((c) => own.has(c.id));
}

/** the counters' words by the list's StatusId (1 approved, 2 pending, 3 rejected), English and Arabic */
const COUNTER_WORDS: Readonly<Record<number, readonly string[]>> = { 1: ['Approved', 'مقبول'], 2: PENDING_WORDS, 3: ['Rejected', 'مرفوض'] };

/** the three counters ("1\nمقبول" / "Approved\n1") by StatusId; a counter not on the screen is left out */
export function countersOf(descs: string[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const l of descs.map(linesOf)) {
    if (l.length !== 2) continue;
    const [n, word] = /^\d+$/.test(l[0]) ? [l[0], l[1]] : [l[1], l[0]];
    const status = Object.entries(COUNTER_WORDS).find(([, words]) => words.includes(word))?.[0];
    if (status !== undefined && /^\d+$/.test(n)) out[Number(status)] = Number(n);
  }
  return out;
}

/** loaded = the counters show, and a list that has requests shows its cards (run 640: counters came first) */
export function listLoaded(descs: string[]): boolean {
  const counters = countersOf(descs);
  if (counters[2] === undefined) return false;
  return Object.values(counters).every((n) => n === 0) || cardsOf(descs).length > 0;
}

/**
 * the app is signed in as the employee: each counter equals the employee's own list by status, and every card on the
 * screen is in that list (run 640: the app was another employee's, 1 / 1 / 1, while the employee had none); an employee
 * with no request is never proven this way - the case signs in as the employee instead
 */
export function sameEmployee(descs: string[], rows: { ID: number; StatusId: number }[]): boolean {
  if (rows.length === 0) return false; // no request on either side tells two employees apart (run 640)
  const counters = countersOf(descs);
  const counted = (status: number) => rows.filter((r) => r.StatusId === status).length;
  return [1, 2, 3].every((s) => counters[s] === undefined || counters[s] === counted(s)) && allListed(cardsOf(descs), rows.map((r) => r.ID));
}
