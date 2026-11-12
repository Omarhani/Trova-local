import { ScreenSnapshot } from '../screenSnapshot';
import { toastText } from './leaveCards';

/** the app's answer to a request action: its message and whether it was the success one */
export interface SendAnswer {
  ok: boolean;
  text: string;
}

/** the snackbar on the screen, if one shows: ok = the success one, its words said once; undefined = none */
export function snackbarOf(s: ScreenSnapshot): SendAnswer | undefined {
  const bar = s.nodes.find((n) => /snackbar/i.test(n.id));
  return bar ? { ok: bar.id === 'success_snackbar', text: toastText(bar.desc || bar.text) } : undefined;
}
