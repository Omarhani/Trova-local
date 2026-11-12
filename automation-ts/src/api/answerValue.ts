import { HttpAnswer, json } from './http';

/** the value at a place of the app's answer ("Data", "Data.Id") as text; "" when the answer has none there */
export function answerValue(answer: HttpAnswer, at: string): string {
  let v: unknown = json(answer);
  for (const key of at.split('.').filter(Boolean)) {
    v = v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined;
  }
  return v === undefined || v === null || typeof v === 'object' ? '' : String(v);
}
