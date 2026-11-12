import { emit } from './liveEvents';

/**
 * Round 2 (tester bug 1, Test 8094 runs 647 / 651 / 653 / 655): a TS run tells Trova the phone and the browser it
 * really used, so the Runs list and the run page show them ("realme 7", "Chrome") as they do for Java and AI runs.
 */

/** the phone of a session: its serial and model, from Appium's own answer; undefined when it says none */
export function phoneSeen(caps: Record<string, unknown>): { phone: string; model: string } | undefined {
  const phone = String(caps['appium:udid'] ?? caps.udid ?? caps.deviceUDID ?? '').trim();
  if (!phone) return undefined;
  const model = [caps.deviceManufacturer, caps.deviceModel].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
  return { phone, model: model || phone };
}

/** the browser the run started (the Run dialog's name: chrome, headlessChrome ...); undefined for none */
export function browserSeen(browser: string | undefined): { browser: string } | undefined {
  return browser?.trim() ? { browser: browser.trim() } : undefined;
}

/** one "device" line on the run's feed; nothing when there is nothing to tell */
export function sayDevice(seen: Record<string, string> | undefined): void {
  if (seen) emit('device', seen);
}
