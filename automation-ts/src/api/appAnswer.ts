import { HttpAnswer, json } from './http';

/** Did the app take the call? HTTP 2xx and no false Result / Status flag; else its own message (Test 8094 run 575). */
export function appAnswer(answer: HttpAnswer): { ok: boolean; message: string } {
  if (answer.status < 200 || answer.status >= 300) return { ok: false, message: messageOf(json(answer)) || `HTTP ${answer.status}` };
  const body = json(answer);
  const o = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const refused = [o.Result, o.result, o.Status, o.status].some((v) => v === false || v === 'false');
  return { ok: !refused, message: refused ? messageOf(o) : '' };
}

function messageOf(body: unknown): string {
  if (body === null || typeof body !== 'object') return typeof body === 'string' ? body.slice(0, 300) : '';
  const o = body as Record<string, unknown>;
  const m = o.Message ?? o.message ?? o.Error ?? o.error;
  return typeof m === 'string' ? m : m === undefined || m === null ? '' : JSON.stringify(m);
}
