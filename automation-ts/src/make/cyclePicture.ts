import { ApiAction, MadeAction, MadeRun, MadeStep } from './madeRun';

/** the value names an action reads or keeps ({holiday_name} -> holiday_name) */
function namesIn(a: MadeAction): string[] {
  const read = [...JSON.stringify(a).matchAll(/\{([A-Za-z_][\w.-]*)}/g)].map((m) => m[1]);
  return a.on === 'api' ? [...read, ...Object.keys(a.keep ?? {})] : read;
}

function stepNames(s: MadeStep): string[] {
  const saw = (s.saw ?? []).flatMap((t) => [...t.matchAll(/\{([A-Za-z_][\w.-]*)}/g)].map((m) => m[1]));
  return [...s.actions.flatMap(namesIn), ...saw];
}

/** plain words of a call's last part (AddHoliday -> holiday) */
function fromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? path;
  return last.replace(/^(Add|Create|Insert|New|Save|Post|Delete|Remove)/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() || last;
}

/** the record an action makes or removes, in plain words (holiday_id -> holiday) */
function recordOf(a: MadeAction): string {
  if (a.on !== 'api') return (a.element ?? (a.on === 'web' ? a.page : a.screen)).toLowerCase();
  const id = [...Object.keys(a.keep ?? {}), ...namesIn(a)].find((n) => /_?id$/i.test(n));
  return id ? id.replace(/_?id$/i, '').replace(/_/g, ' ').trim() : fromPath((a as ApiAction).path);
}

function made(run: MadeRun): string[] {
  const steps = run.steps.filter((s) => s.step > 0);
  return run.setup.map((a) => {
    const names = new Set(namesIn(a));
    const user = steps.find((s) => stepNames(s).some((n) => names.has(n)));
    return `Made first: ${recordOf(a)} - ${user ? `step ${user.step} uses it` : 'no step uses it, check why it is made'}`;
  });
}

function actors(run: MadeRun): string[] {
  const all = [...run.setup, ...run.steps.flatMap((s) => s.actions), ...run.cleanup];
  const as = all.flatMap((a) => (a.on === 'api' ? [a.as] : [a.login]));
  return [...new Set([run.login, ...as].filter((x): x is string => !!x))];
}

/**
 * The business cycle of one case in plain words, before any code (writing-automation-script step 0): who acts, what is
 * made first and which step needs it, the steps in order, what is checked, what is undone at the end. A set-up no step
 * uses is flagged. No locator, call path or value is in it - the tester reads it before saving.
 */
export function cyclePicture(run: MadeRun): string[] {
  const steps = run.steps.filter((s) => s.step > 0);
  const checked = steps.map((s) => s.expected).filter((e): e is string => !!e?.trim());
  const undone = [...new Set(run.cleanup.map(recordOf))];
  const madeFirst = made(run);
  return [
    `Who: ${actors(run).join(', ')}`,
    ...(madeFirst.length ? madeFirst : ['Made first: nothing']),
    `Steps: ${steps.map((s) => `${s.step}. ${s.text.replace(/\s+/g, ' ').trim()}`).join(' > ')}`,
    `Checked: ${checked.length ? checked.join('; ') : 'nothing written'}`,
    `Undone at the end: ${undone.length ? undone.join(', ') : 'nothing'}`,
  ].map((line) => line.replace(/\*\//g, '* /'));
}
