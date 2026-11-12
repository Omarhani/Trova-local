/**
 * Trova's own blank stand-in page on the app's origin: a kept sign-in is put into the browser there before the app
 * opens. It is ours on any app - never shown to customers: no event, picture, step text or report names it.
 */
export const STAND_IN_PATH = '/trova-sign-in';

/** the stand-in's address on this app */
export function standInAddress(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${STAND_IN_PATH}`;
}

/** the address is the stand-in page (any app, any query or hash) */
export function onStandIn(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === STAND_IN_PATH;
  } catch {
    return false;
  }
}
