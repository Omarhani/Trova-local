import { emit } from '../report/liveEvents';
import { currentStep } from '../report/stepNumbers';
import { ScreenSnapshot } from './screenSnapshot';

/** Android's own permission question: its buttons (allow, allow once, while using, deny) live in the permission controller */
const SYSTEM_POPUP = /permission_(allow|deny)|permissioncontroller/i;

/** the most a step waits for a pop-up that may not come (run 985: the question never came, the step waited and was Blocked) */
const POPUP_SECONDS = 3;

/** the kinds of permission Android asks for, as a tester says them; anything else is "permission" */
const KINDS: [RegExp, string][] = [
  [/location/i, 'location'],
  [/notification/i, 'notifications'],
  [/camera|pictures|record video/i, 'camera'],
  [/microphone|record audio/i, 'microphone'],
  [/contacts/i, 'contacts'],
  [/photos|media|files|storage/i, 'photos and files'],
  [/calendar/i, 'calendar'],
  [/nearby|bluetooth/i, 'nearby devices'],
  [/phone calls/i, 'phone calls'],
];

/**
 * Omar 2026-11-12 (Test 8094 run 985, case 519): a step on Android's own permission question is optional - the question
 * may or may not appear (the app may already have the permission), and that never decides a case by itself.
 */
export function systemPopup(selector: string): boolean {
  return SYSTEM_POPUP.test(selector);
}

/** a pop-up step waits its own time, never more than 3 s */
export function optionalPopupSeconds(seconds: number): number {
  return Math.min(seconds, POPUP_SECONDS);
}

/** the permission in plain words, from the step's name or the question's own words */
export function popupKind(words: string): string {
  return KINDS.find(([re]) => re.test(words))?.[1] ?? 'permission';
}

/** the question's own words on this screen ("Allow Availo to access this device's location?"), or '' */
export function questionWords(s: ScreenSnapshot): string {
  const message = s.nodes.find((n) => /permission_message/.test(n.id));
  return message ? message.text || message.desc : '';
}

/**
 * The run's warning (never a failure): the pop-up appeared and Trova allowed it, or it did not appear and its step was
 * skipped. Trova's run page shows it with "Handle it every time" and "Report a bug".
 */
export function popupNote(popup: string, appeared: boolean, element = '', answer: 'allowed' | 'denied' = 'allowed'): void {
  emit('popup', { popup, appeared, answer, n: currentStep(), e: element });
}

/** how the step answers the question: its deny button = denied, any other = allowed */
export function answerOf(selector: string): 'allowed' | 'denied' {
  return /permission_deny/i.test(selector) ? 'denied' : 'allowed';
}
