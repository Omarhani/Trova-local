/** how the run's browser starts: Playwright's engine, the installed browser for Chromium, hidden or visible */
export interface BrowserChoice {
  engine: 'chromium' | 'firefox' | 'webkit';
  channel?: 'chrome' | 'msedge';
  headless: boolean;
}

const KNOWN: Record<string, BrowserChoice> = {
  chrome: { engine: 'chromium', channel: 'chrome', headless: false },
  edge: { engine: 'chromium', channel: 'msedge', headless: false },
  firefox: { engine: 'firefox', headless: false },
  safari: { engine: 'webkit', headless: false },
};

/**
 * The browser a suite asked for, as base.BrowserStart opens it: Chrome, Edge, Firefox and Safari (WebKit) visible,
 * their "headless..." names hidden; an unfilled ${...} is Chrome, nothing picked is hidden Chrome.
 */
export function browserChoice(picked: string): BrowserChoice {
  const name = picked.trim();
  if (name === '') return { ...KNOWN.chrome, headless: true };
  if (name.startsWith('${')) return { ...KNOWN.chrome };
  const lower = name.toLowerCase();
  const hidden = lower.startsWith('headless');
  const known = KNOWN[hidden ? lower.slice('headless'.length) : lower];
  if (!known) {
    throw new Error(`Unknown browser "${name}": use Chrome, Edge, Firefox, Safari, headlessChrome, headlessEdge, headlessFirefox or headlessSafari`);
  }
  return { ...known, headless: hidden };
}

/** the run's own pick (TROVA_BROWSER from the Run dialog) first, then the suite's browser parameter, then hidden Chrome */
export function pickedBrowser(env: Record<string, string | undefined> = process.env, suiteParams: Record<string, string> = {}): string {
  const run = env.TROVA_BROWSER?.trim();
  if (run) return run;
  const suite = suiteParams.browser?.trim();
  return suite && !suite.startsWith('${') ? suite : 'headlessChrome';
}
