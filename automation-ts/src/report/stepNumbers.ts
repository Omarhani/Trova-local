/**
 * The one running number of a test process's lines on the run screen: steps and checks count together (step 5,
 * check 6, step 7), web and phone alike, so every line has its number and a picture belongs to the line it follows.
 */
let last = 0;

/** the number of the line being said now */
export function nextStep(): number {
  return ++last;
}

/** the number of the last line said (the step or check a picture shows) */
export function currentStep(): number {
  return last;
}
