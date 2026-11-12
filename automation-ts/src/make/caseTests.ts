import { answerChecks, callCodeCheck, sawChecks } from './checkWriter';
import { Channel } from './kindOf';
import { ApiAction, MadeAction, MadeRun, MadeStep, WebAction } from './madeRun';
import { cleanUpName, quote, valueVar } from './names';
import { PartMaker } from './partMaker';
import { SpecUses, TestWriter, WrittenTest } from './testWriter';

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function step(w: TestWriter, s: MadeStep): void {
  if (!s.actions.length && !(s.expected && s.saw?.length && w.screen())) return;
  w.line(`// ${s.step}. ${oneLine(s.text)}`);
  for (const a of s.actions) {
    if (a.on === 'api') w.call(a, (answer) => answerChecks(s, a, answer, w.values, w.indent));
    else w.ui(a, s.step);
  }
  const screen = w.screen();
  if (screen) w.add(sawChecks(s, screen, w.values, w.indent));
}

function setUp(w: TestWriter, actions: MadeAction[]): void {
  if (!actions.length) return;
  w.line('// set-up');
  actions.forEach((a, i) => (a.on === 'api' ? w.call(a, (answer) => callCodeCheck(`Set-up ${i + 1}`, a, answer, w.indent)) : w.ui(a, 0)));
  w.line('');
}

/** the case's own test: the set-up, then each step with the checks of what the AI saw or the answers it checked */
export function caseTest(run: MadeRun, channel: Channel, parts: PartMaker, uses: SpecUses, method: string): WrittenTest {
  const w = new TestWriter(run, parts, uses);
  if (channel === 'phone') w.openPhone();
  setUp(w, run.setup);
  run.steps.forEach((s) => step(w, s));
  return w.done(method);
}

/** the values an answer of the run made (ids) that the clean-up needs */
export function keptNames(run: MadeRun): Set<string> {
  const calls = [...run.setup, ...run.steps.flatMap((s) => s.actions)].filter((a): a is ApiAction => a.on === 'api');
  return new Set(calls.flatMap((a) => Object.keys(a.keep ?? {})));
}

/** a clean-up call for each record this run kept (newest first), each forgotten once it is gone */
function cleanUpCall(w: TestWriter, a: ApiAction, n: number, kept: Set<string>): void {
  const reads = [...JSON.stringify(a.body ?? {}).matchAll(/\{([A-Za-z_][\w.-]*)}/g)].map((m) => m[1]);
  const k = reads.find((name) => kept.has(name));
  const checks = (answer: string) => callCodeCheck(`Clean up ${n}`, a, answer, w.indent);
  if (!k) return w.call(a, checks);
  const local = valueVar(k);
  w.uses.run.add('runRecords');
  w.line(`for (const ${local} of runRecords.newestFirst(${quote(k)})) {`);
  w.values.keep(k, local);
  w.indent = '    ';
  w.call(a, checks);
  w.line(`runRecords.forget(${quote(k)}, ${local});`);
  w.indent = '  ';
  w.line('}');
}

/** the clean-up as its own test, run after the case: by API (hybrid) or on the screens (full screen mode) */
export function cleanUpTest(run: MadeRun, parts: PartMaker, uses: SpecUses, method: string): WrittenTest | undefined {
  if (!run.cleanup.length) return undefined;
  const w = new TestWriter(run, parts, uses);
  if (run.cleanup.some((a) => a.on === 'phone')) w.openPhone();
  const firstWeb = run.cleanup.find((a): a is WebAction => a.on === 'web');
  if (firstWeb && firstWeb.action.toLowerCase() !== 'open') w.ui({ ...firstWeb, action: 'open' }, 0);
  const kept = keptNames(run);
  run.cleanup.forEach((a, i) => (a.on === 'api' ? cleanUpCall(w, a, i + 1, kept) : w.ui(a, 0)));
  return w.done(cleanUpName(method));
}
