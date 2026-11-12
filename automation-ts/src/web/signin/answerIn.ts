/** the work's answer, or an error in plain words (said) when the browser has not answered within ms */
export async function answerIn<T>(work: Promise<T>, ms: number, said: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error(said)), ms); });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** waits for the work at most ms; a late or failed answer is let go (the work can do no harm when it never ends) */
export async function waitAtMost(work: Promise<unknown>, ms: number): Promise<void> {
  await answerIn(work, ms, '').catch(() => undefined);
}
