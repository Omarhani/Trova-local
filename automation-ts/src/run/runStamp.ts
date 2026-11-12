import { randomBytes } from 'node:crypto';

/** this run's stamp: TROVA_RUN_STAMP (the runner gives every block of a run the same one), else a fresh 6 letters */
export const RUN_STAMP: string = process.env.TROVA_RUN_STAMP?.trim() || randomBytes(3).toString('hex');

/** "{run}" / "{run:340}" in a data value become the run's stamp - a new value every run (TICKET-984) */
export function fresh(value: string, stamp: string = RUN_STAMP): string {
  return value.replace(/\{run(?::[^}]*)?}/g, stamp);
}
