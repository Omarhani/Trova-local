/** what the page tells about a switch element (read in the browser by readSwitchFacts) */
export interface SwitchFacts {
  ariaChecked: string | null;
  ariaPressed: string | null;
  tag: string;
  /** a native input's checked state */
  checked: boolean;
  /** an inner checkbox / radio / role=switch: its state; null when there is none */
  inner: boolean | null;
  className: string;
}

const ON_CLASS = /[\s_-](on|checked|active|is-checked|ant-switch-checked|mat-checked|mdc-switch--selected)[\s_-]/;

function filled(v: string | null): string | null {
  return v !== null && v.trim() !== '' ? v : null;
}

/**
 * Is the switch on? - the TS twin of utils.Switches.isOn: aria-checked / aria-pressed first, a native input's checked,
 * an inner input, else an "on / checked / active" class word.
 */
export function switchIsOn(f: SwitchFacts): boolean {
  const aria = filled(f.ariaChecked) ?? filled(f.ariaPressed);
  if (aria !== null) return aria.toLowerCase() === 'true';
  if (f.tag.toLowerCase() === 'input') return f.checked;
  if (f.inner !== null) return f.inner;
  return ON_CLASS.test(` ${f.className.toLowerCase()} `);
}

/** runs in the browser: the facts of one switch element */
export function readSwitchFacts(el: Element): SwitchFacts {
  const inner = el.querySelector('input[type=checkbox],input[type=radio],[role=switch],[role=checkbox]');
  return {
    ariaChecked: el.getAttribute('aria-checked'),
    ariaPressed: el.getAttribute('aria-pressed'),
    tag: el.tagName,
    checked: (el as HTMLInputElement).checked === true,
    inner: inner === null ? null
      : inner.tagName === 'INPUT' ? (inner as HTMLInputElement).checked : inner.getAttribute('aria-checked') === 'true',
    className: String(el.getAttribute('class') ?? ''),
  };
}
