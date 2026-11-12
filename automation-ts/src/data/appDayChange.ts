/** yyyy-MM-dd -> dd/MM/yyyy */
function shown(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Run 1026 (23:08 on the gate's clock, 00:08 on the account's): the app saved the check in on its gate's day while
 * its own day had already changed, and home never offered Check-Out. That hour the case cannot be judged - BLOCKED
 * with this reason. Same day, or no check in saved: undefined (home staying on Check-In is then a real failure).
 */
export function dayChangedReason(checkInDay: string | undefined, appDay: string): string | undefined {
  if (!checkInDay || checkInDay === appDay) return undefined;
  return `The app does not allow a check in at this hour - its day changed: the check in was saved on ${shown(checkInDay)}, `
    + `while the app is already on ${shown(appDay)}, so home does not offer Check-Out. Run the case again once both days match`;
}
