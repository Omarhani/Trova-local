import { param } from './blockParams';

/**
 * How a suite signs in and cleans up (Omar 2026-11-10): "hybrid" - sign-in and clean-up by the app's own API calls,
 * the test on the screens; "ui" (full screen mode) - sign-in and clean-up through the screens, never the API. Both sign
 * in ONCE per run. It comes from the suite's (or a block's) <parameter name="mode" value="ui"/>; hybrid when none.
 */
export type RunMode = 'hybrid' | 'ui';

const UI = /^(full[ _-]?)?ui$|^screens?$/i;

/** the mode a parameter value names; hybrid for anything else */
export function modeOf(value: string | undefined): RunMode {
  return value && UI.test(value.trim()) ? 'ui' : 'hybrid';
}

/** the running test's mode: TROVA_MODE for a local try, else the suite's mode parameter */
export function runMode(env: NodeJS.ProcessEnv = process.env): RunMode {
  const forced = env.TROVA_MODE?.trim();
  if (forced) return modeOf(forced);
  try {
    return modeOf(param('mode', 'hybrid'));
  } catch {
    return 'hybrid'; // outside a test (the run's set-up): the default
  }
}
