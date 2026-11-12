/** one leave category of the phone app's GET Leaves/LeaveTypes, with its sub types */
export interface LeaveCategory {
  ID: number;
  NameAr?: string;
  NameEn?: string;
  SubTypes?: { ID: number; NameAr?: string; NameEn?: string }[];
}

/** what the new-leave form needs: the category card ("Leave") and the type in its list ("Sick leave") */
export interface LeaveKind {
  categoryId: number;
  typeId: number;
  nameEn: string;
  nameAr: string;
}

const same = (a: string | undefined, b: string): boolean => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

/** the type named in English or Arabic, any case, read from the app's own list at run time (never a fixed id) */
export function leaveKindOf(categories: LeaveCategory[], name: string): LeaveKind {
  for (const c of categories) {
    const t = (c.SubTypes ?? []).find((s) => same(s.NameEn, name) || same(s.NameAr, name));
    if (t) return { categoryId: c.ID, typeId: t.ID, nameEn: t.NameEn ?? '', nameAr: t.NameAr ?? '' };
  }
  const names = categories.flatMap((c) => (c.SubTypes ?? []).map((s) => s.NameEn ?? s.NameAr ?? ''));
  throw new Error(`The app has no leave type "${name.trim()}" (it has: ${names.join(', ')})`);
}
