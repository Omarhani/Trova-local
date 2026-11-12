/**
 * Test 8094 run 960 case 529: the case's page did not open and the case was BLOCKED with no picture - the test end that
 * keeps the last screen never ran. A page open that fails keeps the screen at that moment first (a picture that cannot
 * be taken never hides the reason), then its reason goes on as it was.
 */
export async function openKeepingEnd(open: () => Promise<void>, keep: () => Promise<void>): Promise<void> {
  try {
    await open();
  } catch (e) {
    await keep().catch(() => undefined);
    throw e;
  }
}
