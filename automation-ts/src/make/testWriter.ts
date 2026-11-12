import { Check } from './checkWriter';
import { AreaName } from './classPlacer';
import { ApiAction, MadeRun, PhoneAction, WebAction } from './madeRun';
import { lowerFirst, pascal, quote, valueVar } from './names';
import { MethodRef, PartMaker } from './partMaker';
import { ValueCode } from './valueCode';

export type Fixture = 'page' | 'phone' | 'none';

/** what the spec file imports, gathered from all its tests */
export class SpecUses {
  readonly classes = new Map<string, AreaName>();
  readonly checks = new Set<string>();
  readonly run = new Set<'param' | 'runLogin' | 'credentials' | 'runRecords' | 'answerValue' | 'AppApi' | 'openSignedIn'>();
}

/** one test of the spec: its name, what it needs from the test base, its lines and its checks */
export interface WrittenTest {
  name: string;
  fixture: Fixture;
  lines: string[];
  checks: Check[];
}

const TYPE = /^(type|fill|enter)$/i;

/**
 * Make automation: one test's lines - each action of the run a call of a page, screen or API method (reused or added
 * by the PartMaker), the case values read once by name, the run's one sign-in by API when a call needs it.
 */
export class TestWriter {
  readonly checks: Check[] = [];
  readonly values: ValueCode;
  fixture: Fixture = 'none';
  indent = '  ';
  private readonly body: string[] = [];
  private readonly objects = new Map<string, string>();
  private readonly signIns = new Map<string, string>();
  private lastScreen?: string;
  private answers = 0;

  constructor(private readonly run: MadeRun, private readonly parts: PartMaker, readonly uses: SpecUses) {
    this.values = new ValueCode(run.values);
  }

  line(text: string): void {
    this.body.push(text ? `${this.indent}${text}` : '');
  }

  /** the screen the test is on now (where an expected result is looked for) */
  screen(): string | undefined {
    return this.lastScreen;
  }

  /** the app opened signed in as the block's login: the run's one sign-in, kept on the phone */
  openPhone(): void {
    this.fixture = 'phone';
    this.uses.run.add('openSignedIn').add('runLogin').add('param');
    this.line(`await openSignedIn(phone, runLogin(param('signedInAs', ${quote(this.run.login)})));`);
  }

  ui(a: WebAction | PhoneAction, step: number): void {
    const opens = a.on === 'web' && a.action.toLowerCase() === 'open';
    const ref = opens ? this.parts.open(a as WebAction) : this.parts.ui(a, step);
    const obj = this.object(ref, a.on === 'web' ? 'page' : 'phone');
    if (this.fixture === 'none') this.fixture = a.on === 'web' ? 'page' : 'phone';
    this.lastScreen = obj;
    this.line(`await ${obj}.${ref.method}(${opens ? '' : this.uiArgs(a)});`);
  }

  /** an app call; its answer kept in a local only when something reads it (what it made, its checks) */
  call(a: ApiAction, checks: (answer: string) => Check[]): void {
    const ref = this.parts.call(a);
    const obj = this.object(ref, this.signIn(a), a.as ? `As${pascal(a.as) || 'Other'}` : '');
    const body = a.body && Object.keys(a.body).length ? this.values.body(a.body) : '';
    const answer = `answer${++this.answers}`;
    const kept = Object.entries(a.keep ?? {}).flatMap(([name, at]) => {
      const local = valueVar(name);
      this.values.keep(name, local);
      return [`const ${local} = answerValue(${answer}, ${quote(at)});`, `if (${local}) runRecords.keep(${quote(name)}, ${local});`];
    });
    const made = checks(answer);
    if (!kept.length && !made.length) return this.line(`await ${obj}.${ref.method}(${body});`);
    this.line(`const ${answer} = await ${obj}.${ref.method}(${body});`);
    if (kept.length) this.uses.run.add('answerValue').add('runRecords');
    kept.forEach((l) => this.line(l));
    this.add(made);
  }

  add(checks: Check[]): void {
    for (const c of checks) {
      this.uses.checks.add(c.fn);
      this.checks.push(c);
      this.body.push(c.line);
    }
  }

  /** the test: its values read once, its sign-ins and objects, then its steps */
  done(name: string): WrittenTest {
    const values = Object.keys(this.run.values).filter((n) => this.values.used.has(n))
      .map((n) => `const ${valueVar(n)} = param(${quote(n)}, ${quote(this.run.values[n])});`);
    if (values.length) this.uses.run.add('param');
    const head = [...values, ...this.signIns.values(), ...this.objects.values()].map((l) => `  ${l}`);
    return { name, fixture: this.fixture, lines: [...head, ...(head.length && this.body.length ? [''] : []), ...this.body], checks: this.checks };
  }

  private uiArgs(a: WebAction | PhoneAction): string {
    if (TYPE.test(a.action) && a.login) {
      this.uses.run.add('credentials');
      return `credentials.get(${quote(a.login)}, ${quote(a.field ?? 'Password')})`;
    }
    return TYPE.test(a.action) || a.locator?.includes('{row}') ? this.values.text(a.value ?? '') : '';
  }

  /** the page, screen or API object a test calls: one per class (and per login for calls as another login) */
  private object(ref: MethodRef, over: string, suffix = ''): string {
    const name = `${lowerFirst(ref.className)}${suffix}`;
    if (!this.objects.has(name)) this.objects.set(name, `const ${name} = new ${ref.className}(${over});`);
    this.uses.classes.set(ref.className, ref.area);
    return name;
  }

  /** the run's one sign-in by API on the call's side: the block's login, or the login the AI called as */
  private signIn(a: ApiAction): string {
    const own = a.side === 'phone' ? 'phoneApi' : 'appApi';
    const v = a.as ? `${own}As${pascal(a.as) || 'Other'}` : own;
    if (!this.signIns.has(v)) {
      const login = a.as ? quote(a.as) : `runLogin(param('signedInAs', ${quote(this.run.login)}))`;
      this.signIns.set(v, `const ${v} = await AppApi.signedInAs(${login}, '${a.side}');`);
      this.uses.run.add('AppApi');
      if (!a.as) this.uses.run.add('runLogin').add('param');
    }
    return v;
  }
}
