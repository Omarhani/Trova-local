import { MadeRun, MadeStep } from './madeRun';

export const NOT_PASSED = (step: number): string =>
  `Step ${step} did not pass in this AI run - only a case that passed can be made into automation.`;

export const NO_CHECK = 'Nothing in this case checks an expected result the AI saw - a test made from it would prove nothing, so none is made.';

/** a step that checks something: its expected result seen on the screen, or an answer of the app checked */
export function stepChecks(step: MadeStep): boolean {
  if (step.expected?.trim() && (step.saw ?? []).some((t) => t.trim())) return true;
  return step.actions.some((a) => a.on === 'api' && (a.status !== undefined || (a.says ?? []).length > 0));
}

/** why this run cannot be made into a test, in plain words; undefined when it can */
export function runRefusal(run: MadeRun): string | undefined {
  const failed = run.steps.find((s) => !/^pass/i.test(s.result.trim()));
  if (failed) return NOT_PASSED(failed.step);
  return run.steps.some(stepChecks) ? undefined : NO_CHECK;
}
